import { DAY, addMonths, iso } from '../lib/dates.ts'
import { niceMonthly } from '../lib/nice.ts'
import type { ActionType, Automation, Dataset, Donation, Donor, DonorScore, Features, ModelKind, Reason, Segment } from '../lib/types.ts'
import { runExperiment, predictLearned, type Algorithm, type ExperimentResult, type Row } from './experiment.ts'
import { predict as predictLogistic } from './logistic.ts'
import { rfmScore } from './rfm.ts'
import { REQUIREMENTS } from '../lib/requirements.ts'
import { FEATURE_KEYS, ageBandOf, computeFeatures, indexDonations, monthlyAmountAt, regionOf, segmentAt, toVector } from './features.ts'

export type { Algorithm, Learned, Evaluation } from './experiment.ts'

export interface ModelSpec {
  kind: ModelKind
  title: string
  question: string
  action: string
  segments: Segment[]
  horizonDays: number
  snapshotsMonthsAgo: number[]
  rfmSign: 1 | -1
}

const every = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)

export const MODEL_SPECS: Record<ModelKind, ModelSpec> = {
  churn: {
    kind: 'churn',
    title: 'Risque d\'attrition',
    question: 'Ce donateur mensuel va-t-il arrêter son don dans les 90 jours ?',
    action: 'Relancer',
    segments: ['monthly'],
    horizonDays: 90,
    snapshotsMonthsAgo: every(3, 42, 3),
    rfmSign: -1,
  },
  upgrade: {
    kind: 'upgrade',
    title: 'Hausse du don',
    question: 'Ce donateur mensuel va-t-il augmenter son don dans les 6 mois ?',
    action: 'Solliciter plus',
    segments: ['monthly'],
    horizonDays: 180,
    snapshotsMonthsAgo: every(6, 42, 3),
    rfmSign: 1,
  },
  conversion: {
    kind: 'conversion',
    title: 'Passage au mensuel',
    question: 'Ce donateur ponctuel ou annuel va-t-il passer au don mensuel dans les 6 mois ?',
    action: 'Proposer le mensuel',
    segments: ['one_time', 'annual'],
    horizonDays: 180,
    snapshotsMonthsAgo: every(6, 42, 2),
    rfmSign: 1,
  },
  reactivation: {
    kind: 'reactivation',
    title: 'Réactivation',
    question: 'Ce donateur inactif va-t-il redonner dans les 6 mois ?',
    action: 'Réactiver',
    segments: ['lapsed'],
    horizonDays: 180,
    snapshotsMonthsAgo: every(6, 42, 6),
    rfmSign: 1,
  },
}

export const MODEL_KINDS: ModelKind[] = ['churn', 'upgrade', 'conversion', 'reactivation']

export const ALGORITHM_LABELS: Record<string, string> = {
  logistic: 'Régression logistique',
  gbdt: 'Gradient boosting d\'arbres',
  ensemble: 'Ensemble (moyenne des deux)',
  rfm: 'Règle RFM (référence métier)',
}

export interface ModelReport extends ExperimentResult {
  kind: ModelKind
  trainedAt: string
  ms: number
  /**
   * Ce qui sert réellement à classer les donateurs. Règle de gouvernance de l'équipe (suivi S6) :
   * le modèle n'est déployé que s'il bat la règle RFM sur le test (requis R1 et R2), sinon on garde la règle RFM.
   */
  deployed: Algorithm
  /** Choix automatique (true) ou imposé par l'équipe dans l'interface */
  deployedAuto: boolean
}

/** Décision de déploiement : le meilleur modèle (choisi sur la validation) s'il passe R1 et R2, sinon la règle RFM */
export function governanceDecision(r: ExperimentResult & { kind: ModelKind }): Algorithm {
  const asReport = { ...r, deployed: r.selected, deployedAuto: true, trainedAt: '', ms: 0 } as ModelReport
  const pass = REQUIREMENTS.filter((q) => q.id === 'R1' || q.id === 'R2').every((q) => q.check(asReport).ok)
  return pass ? r.selected : 'rfm'
}

function label(kind: ModelKind, d: Donor, gifts: Donation[], T: string, H: number): number {
  const end = iso(new Date(Date.parse(T) + H * DAY))
  if (kind === 'churn') return d.churnDate && d.churnDate > T && d.churnDate <= end ? 1 : 0
  if (kind === 'conversion') return d.convertedAt && d.convertedAt > T && d.convertedAt <= end ? 1 : 0
  if (kind === 'upgrade') {
    const now = monthlyAmountAt(gifts, T) ?? Infinity
    return gifts.some((g) => g.kind === 'monthly' && g.date >= T && g.date <= end && g.amount > now) ? 1 : 0
  }
  return gifts.some((g) => g.status === 'paid' && g.date >= T && g.date <= end) ? 1 : 0
}

function valueIfPositive(kind: ModelKind, d: Donor, gifts: Donation[], f: Features, T: string): number {
  const monthly = monthlyAmountAt(gifts, T) ?? d.monthlyAmount ?? 0
  if (kind === 'churn') return monthly * 12
  if (kind === 'upgrade') return (monthly >= 30 ? 10 : 5) * 12
  if (kind === 'conversion') return suggestMonthly(f) * 12
  return Math.max(f.avgGift, 10)
}

export function suggestMonthly(f: Features): number {
  if (f.isAnnual) return niceMonthly(Math.min(50, Math.max(5, f.avgGift / 12 + 2)))
  return niceMonthly(Math.min(50, Math.max(5, (f.amount12m / 12) * 1.2 || 10)))
}

/** Exemples d'apprentissage : photo du donateur à T, résultat observé sur [T, T+H] */
export function buildRows(ds: Dataset, kind: ModelKind): Row[] {
  const spec = MODEL_SPECS[kind]
  const index = indexDonations(ds.donations)
  const ref = new Date(ds.refDate)
  const out: Row[] = []
  for (const monthsAgo of spec.snapshotsMonthsAgo) {
    const T = iso(addMonths(ref, -monthsAgo))
    if (Date.parse(T) + spec.horizonDays * DAY > ref.getTime() || T < ds.historyStart) continue
    for (const d of ds.donors) {
      const gifts = index.get(d.id) ?? []
      const seg = segmentAt(d, gifts, T)
      if (!seg || !spec.segments.includes(seg)) continue
      // hausse : il faut un montant mensuel de référence (sinon un nouveau mensuel compterait comme une « hausse »)
      if (kind === 'upgrade' && monthlyAmountAt(gifts, T) === undefined) continue
      const f = computeFeatures(d, gifts, T, ds.historyStart)
      out.push({
        group: d.id,
        period: -monthsAgo,
        x: toVector(f),
        y: label(kind, d, gifts, T, spec.horizonDays),
        rfm: { recency: f.recencyDays, frequency: f.giftsLifetime, monetary: f.avgGift },
        value: valueIfPositive(kind, d, gifts, f, T),
        ageBand: ageBandOf(d.age),
        region: regionOf(d.city),
      })
    }
  }
  return out
}

export function trainModel(ds: Dataset, kind: ModelKind, opts: { learningCurve?: boolean } = {}): ModelReport | null {
  const t0 = performance.now()
  const res = runExperiment(buildRows(ds, kind), FEATURE_KEYS, { rfmSign: MODEL_SPECS[kind].rfmSign, epochs: 400, bootstrapRounds: 150, learningCurve: opts.learningCurve })
  if (!res) return null
  const base = { ...res, kind, trainedAt: new Date().toISOString(), ms: Math.round(performance.now() - t0) }
  return { ...base, deployed: governanceDecision(base), deployedAuto: true }
}

export function trainAll(ds: Dataset, onProgress?: (kind: ModelKind) => void): Partial<Record<ModelKind, ModelReport>> {
  const out: Partial<Record<ModelKind, ModelReport>> = {}
  for (const k of MODEL_KINDS) {
    onProgress?.(k)
    const r = trainModel(ds, k)
    if (r) out[k] = r
  }
  return out
}

const IDX = { recency: FEATURE_KEYS.indexOf('recencyDays'), frequency: FEATURE_KEYS.indexOf('giftsLifetime'), monetary: FEATURE_KEYS.indexOf('avgGift') }

export function predictReport(r: ModelReport, x: number[]): number {
  if (r.deployed === 'rfm') {
    const raw = { recency: Math.expm1(x[IDX.recency]), frequency: Math.expm1(x[IDX.frequency]), monetary: Math.expm1(x[IDX.monetary]) }
    return predictLogistic(r.rfmModel, [r.rfmSign * rfmScore(r.rfm, raw)])
  }
  return predictLearned(r, r.deployed, x)
}

const money = (n: number) => `${Math.round(n)} $`
const pts = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))} pts`

export function reasonText(feature: keyof Features, f: Features, high: boolean): string {
  switch (feature) {
    case 'recencyDays': return high ? `Dernier don il y a ${f.recencyDays} jours` : `A donné récemment (il y a ${f.recencyDays} j)`
    case 'gifts12m': return high ? `${f.gifts12m} dons sur les 12 derniers mois` : `Peu de dons sur 12 mois (${f.gifts12m})`
    case 'amount12m': return high ? `A donné ${money(f.amount12m)} sur 12 mois` : `Montants faibles sur 12 mois (${money(f.amount12m)})`
    case 'tenureMonths': return high ? `Fidèle depuis ${f.tenureMonths} mois` : `Donateur récent (${f.tenureMonths} mois)`
    case 'failed90d': return high ? `${f.failed90d} paiement${f.failed90d > 1 ? 's échoués' : ' échoué'} sur 90 jours` : 'Aucun échec de paiement récent'
    case 'openRate3m': return high ? `Ouvre ${Math.round(f.openRate3m * 100)} % des courriels` : `N'ouvre que ${Math.round(f.openRate3m * 100)} % des courriels`
    case 'engagementTrend': return high ? `Engagement en hausse (${pts(f.engagementTrend)})` : `Engagement en baisse (${pts(f.engagementTrend)})`
    case 'amountTrend': return high ? "Donne plus qu'il y a un an" : "Donne moins qu'il y a un an"
    case 'giftsLifetime': return high ? `${f.giftsLifetime} dons au total` : `Seulement ${f.giftsLifetime} don${f.giftsLifetime > 1 ? 's' : ''} au total`
    case 'avgGift': return high ? `Don moyen élevé (${money(f.avgGift)})` : `Don moyen modeste (${money(f.avgGift)})`
    case 'lastGiftRatio': return high ? 'Dernier don plus élevé que d\'habitude' : 'Dernier don plus faible que d\'habitude'
    case 'anniversarySoon': return high ? 'Date anniversaire de son don annuel dans moins de 3 mois' : 'Loin de la date anniversaire de son don'
    case 'emailOptOut': return high ? 'Ne reçoit pas nos courriels' : 'Reçoit nos courriels'
    case 'isAnnual': return high ? 'Donne une fois par an' : 'Donne ponctuellement'
    case 'channelWeb': return high ? 'Recruté en ligne' : 'Pas recruté en ligne'
    case 'channelEvent': return high ? 'Recruté lors d\'un événement' : 'Pas recruté lors d\'un événement'
    case 'channelStreet': return high ? 'Recruté dans la rue (face-à-face)' : 'Pas recruté dans la rue'
    case 'seasonQ4': return high ? 'Période des fêtes à venir' : 'Hors période des fêtes'
  }
}

const logit = (p: number) => Math.log(Math.max(p, 1e-9) / Math.max(1 - p, 1e-9))

/**
 * Explication locale valable pour tout modèle : on remplace chaque variable par sa moyenne
 * et on mesure de combien la prédiction (en logit) change. Les variables binaires de contexte
 * ne sont citées que si elles sont actives, pour éviter des raisons du type « pas recruté en ligne ».
 */
export function explain(report: ModelReport, x: number[], f: Features): Reason[] {
  const base = logit(predictReport(report, x))
  return x
    .map((v, j) => {
      const neutral = [...x]
      neutral[j] = report.means[j]
      return { j, impact: base - logit(predictReport(report, neutral)), high: v > report.means[j] }
    })
    .filter((c) => c.impact > 0.05)
    .filter((c) => !['emailOptOut', 'isAnnual', 'channelWeb', 'channelEvent', 'channelStreet', 'seasonQ4', 'anniversarySoon'].includes(FEATURE_KEYS[c.j]) || c.high)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(({ j, impact, high }) => ({ feature: FEATURE_KEYS[j], impact, text: reasonText(FEATURE_KEYS[j], f, high) }))
}

export const DEFAULT_AUTOMATIONS: Automation[] = [
  { type: 'churn_prevention', enabled: true, threshold: 0.12, requireApproval: true },
  { type: 'upgrade_amount', enabled: true, threshold: 0.1, requireApproval: true },
  { type: 'upgrade_one_time', enabled: true, threshold: 0.06, requireApproval: true },
  { type: 'upgrade_annual', enabled: true, threshold: 0.06, requireApproval: true },
  { type: 'reactivation', enabled: true, threshold: 0.25, requireApproval: true },
  { type: 'thank', enabled: true, threshold: 0, requireApproval: true },
]

/** Règle de remerciement (sans IA, volontairement) : nouveau donateur, don inhabituel, anniversaire du mensuel */
function thankReason(gifts: Donation[], T: string, f: Features): string | undefined {
  const paid = gifts.filter((g) => g.status === 'paid' && g.date < T)
  const last = paid.at(-1)
  if (!last || (Date.parse(T) - Date.parse(last.date)) / DAY > 30) return undefined
  if (paid.length === 1) return 'Premier don : lui souhaiter la bienvenue'
  const prev = paid.slice(0, -1)
  const prevAvg = prev.reduce((s, g) => s + g.amount, 0) / prev.length
  if (last.kind !== 'monthly' && last.amount >= Math.max(250, 2 * prevAvg)) return `Don inhabituel de ${last.amount} $`
  if (last.kind === 'monthly' && f.tenureMonths > 0 && [12, 24, 36, 48].includes(paid.filter((g) => g.kind === 'monthly').length))
    return `${paid.filter((g) => g.kind === 'monthly').length / 12} an(s) de don mensuel`
  return undefined
}

/** Score tous les donateurs à la date d'analyse et choisit l'action la plus utile */
export function scoreAll(ds: Dataset, reports: Partial<Record<ModelKind, ModelReport>>, automations: Automation[] = DEFAULT_AUTOMATIONS): DonorScore[] {
  const index = indexDonations(ds.donations)
  const T = ds.refDate
  const auto = (t: ActionType) => automations.find((a) => a.type === t)
  const on = (t: ActionType, p: number) => {
    const a = auto(t)
    return !!a && a.enabled && p >= a.threshold
  }
  const out: DonorScore[] = []
  for (const d of ds.donors) {
    const gifts = index.get(d.id) ?? []
    const segment = segmentAt(d, gifts, T)
    if (!segment) continue
    const f = computeFeatures(d, gifts, T, ds.historyStart)
    const x = toVector(f)
    const p = (k: ModelKind) => (reports[k] ? predictReport(reports[k]!, x) : undefined)
    const monthly = monthlyAmountAt(gifts, T) ?? d.monthlyAmount ?? 0
    const score: DonorScore = { donorId: d.id, segment, features: f, actionProb: 0, expectedValue: 0, reasons: [] }
    let kind: ModelKind

    if (segment === 'monthly') {
      score.churnProb = p('churn')
      score.upgradeProb = p('upgrade')
      // on ne sollicite pas une hausse chez quelqu'un qui risque de partir
      if (score.churnProb !== undefined && on('churn_prevention', score.churnProb)) kind = 'churn'
      else if (score.upgradeProb !== undefined && on('upgrade_amount', score.upgradeProb)) kind = 'upgrade'
      else kind = (score.churnProb ?? 0) >= (score.upgradeProb ?? 0) ? 'churn' : 'upgrade'
    } else if (segment === 'lapsed') {
      kind = 'reactivation'
      score.reactivationProb = p('reactivation')
    } else {
      kind = 'conversion'
      score.conversionProb = p('conversion')
      score.suggestedMonthly = suggestMonthly(f)
    }
    if (kind === 'upgrade') score.suggestedMonthly = monthly + (monthly >= 30 ? 10 : 5)

    const report = reports[kind]
    const prob = p(kind) ?? 0
    const action: ActionType =
      kind === 'churn' ? 'churn_prevention' : kind === 'upgrade' ? 'upgrade_amount' : kind === 'reactivation' ? 'reactivation' : f.isAnnual ? 'upgrade_annual' : 'upgrade_one_time'
    const value = valueIfPositive(kind, d, gifts, f, T)
    score.actionProb = prob
    score.expectedValue = Math.round(value * prob)
    score.reasons = report ? explain(report, x, f) : []
    score.action = report && on(action, prob) ? action : undefined

    const thanks = thankReason(gifts, T, f)
    if (thanks && auto('thank')?.enabled) {
      // un remerciement passe avant toute sollicitation : on ne demande pas juste après un don
      score.thankReason = thanks
      if (score.action !== 'churn_prevention') score.action = 'thank'
    }
    out.push(score)
  }
  return out.sort((a, b) => b.expectedValue - a.expectedValue)
}
