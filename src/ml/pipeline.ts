import { DAY, addMonths, iso } from '../lib/dates.ts'
import { niceMonthly } from '../lib/nice.ts'
import type { ActionType, Automation, Dataset, Donation, Donor, DonorScore, Features, ModelKind, Reason, Segment } from '../lib/types.ts'
import { FEATURE_KEYS, computeFeatures, indexDonations, segmentAt, toVector } from './features.ts'
import { predictGbdt, trainGbdt, type GbdtModel } from './gbdt.ts'
import { predict as predictLogistic, train as trainLogistic, type LogisticModel } from './logistic.ts'
import { auc, calibration, logLoss, rocCurve, topK } from './metrics.ts'

export interface ModelSpec {
  kind: ModelKind
  title: string
  question: string
  segments: Segment[]
  horizonDays: number
  /** Dates d'observation, en mois avant la date d'analyse */
  snapshotsMonthsAgo: number[]
  baselineName: string
  baseline: (f: Features) => number
}

export const MODEL_SPECS: Record<ModelKind, ModelSpec> = {
  churn: {
    kind: 'churn',
    title: 'Risque de churn',
    question: 'Ce donateur mensuel va-t-il arrêter son don dans les 90 jours ?',
    segments: ['monthly'],
    horizonDays: 90,
    snapshotsMonthsAgo: [3, 6, 9, 12, 15, 18, 21, 24],
    baselineName: 'Règle : paiements échoués',
    baseline: (f) => f.failed90d,
  },
  conversion: {
    kind: 'conversion',
    title: 'Passage au don mensuel',
    question: 'Ce donateur ponctuel ou annuel va-t-il passer au mensuel dans les 6 mois ?',
    segments: ['one_time', 'annual'],
    horizonDays: 180,
    snapshotsMonthsAgo: [6, 9, 12, 15, 18, 21, 24],
    baselineName: 'Règle : nombre de dons (12 mois)',
    baseline: (f) => f.gifts12m,
  },
  reactivation: {
    kind: 'reactivation',
    title: 'Réactivation',
    question: 'Ce donateur inactif va-t-il redonner dans les 6 mois ?',
    segments: ['lapsed'],
    horizonDays: 180,
    snapshotsMonthsAgo: [6, 9, 12, 15, 18, 21, 24],
    baselineName: 'Règle : don le plus récent',
    baseline: (f) => -f.recencyDays,
  },
}

export const MODEL_KINDS: ModelKind[] = ['churn', 'conversion', 'reactivation']

interface Example {
  donorId: string
  x: number[]
  f: Features
  y: number
}

export type Algorithm = 'logistic' | 'gbdt' | 'rule'

export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  logistic: 'Régression logistique',
  gbdt: "Gradient boosting d'arbres",
  rule: 'Règle métier (référence)',
}

export type TrainedModel =
  | { algorithm: 'logistic'; model: LogisticModel }
  | { algorithm: 'gbdt'; model: GbdtModel }

export interface Evaluation {
  algorithm: Algorithm
  auc: number
  logLoss?: number
  top10: { precision: number; lift: number; recall: number }
  roc: { fpr: number; tpr: number }[]
  calibration?: { predicted: number; observed: number; n: number }[]
  /** Importance normalisée (somme = 1) ; signe = sens de l'effet pour la régression logistique */
  importance?: { feature: keyof Features; value: number }[]
}

export interface ModelReport {
  kind: ModelKind
  trainedAt: string
  nTrain: number
  nTest: number
  positivesTrain: number
  baseRate: number
  evaluations: Evaluation[]
  /** Algorithme retenu (meilleure AUC sur le jeu de test) */
  selected: TrainedModel['algorithm']
  models: TrainedModel[]
  /** Valeurs moyennes des variables, utilisées pour expliquer les prédictions */
  means: number[]
}

export function predictWith(m: TrainedModel, x: number[]): number {
  return m.algorithm === 'logistic' ? predictLogistic(m.model, x) : predictGbdt(m.model, x)
}

export function selectedModel(r: ModelReport): TrainedModel {
  return r.models.find((m) => m.algorithm === r.selected)!
}

function label(kind: ModelKind, d: Donor, gifts: Donation[], T: string, H: number): number {
  const end = iso(new Date(Date.parse(T) + H * DAY))
  if (kind === 'churn') return d.churnDate && d.churnDate > T && d.churnDate <= end ? 1 : 0
  if (kind === 'conversion') return d.convertedAt && d.convertedAt > T && d.convertedAt <= end ? 1 : 0
  return gifts.some((g) => g.status === 'paid' && g.date >= T && g.date <= end) ? 1 : 0
}

/** Construit les exemples d'entraînement : photo du donateur à T, résultat observé sur [T, T+H] */
export function buildExamples(ds: Dataset, kind: ModelKind): Example[] {
  const spec = MODEL_SPECS[kind]
  const index = indexDonations(ds.donations)
  const ref = new Date(ds.refDate)
  const out: Example[] = []
  for (const monthsAgo of spec.snapshotsMonthsAgo) {
    const T = iso(addMonths(ref, -monthsAgo))
    if (Date.parse(T) + spec.horizonDays * DAY > ref.getTime()) continue
    if (T < ds.historyStart) continue
    for (const d of ds.donors) {
      const gifts = index.get(d.id) ?? []
      const seg = segmentAt(d, gifts, T)
      if (!seg || !spec.segments.includes(seg)) continue
      const f = computeFeatures(d, gifts, T, ds.historyStart)
      out.push({ donorId: d.id, x: toVector(f), f, y: label(kind, d, gifts, T, spec.horizonDays) })
    }
  }
  return out
}

/** Découpage par donateur (un donateur est soit en entraînement, soit en test) */
function isTest(donorId: string): boolean {
  let h = 0
  for (const c of donorId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 5 === 0
}

export interface TrainOptions {
  epochs?: number
  l2?: number
  rounds?: number
  depth?: number
  /** Forcer un algorithme au lieu de prendre le meilleur */
  force?: TrainedModel['algorithm']
}

function evaluate(algorithm: Algorithm, p: number[], y: number[], probabilities: boolean): Evaluation {
  return {
    algorithm,
    auc: auc(p, y),
    logLoss: probabilities ? logLoss(p, y) : undefined,
    top10: topK(p, y),
    roc: rocCurve(p, y),
    calibration: probabilities ? calibration(p, y) : undefined,
  }
}

function normalize(values: number[]): { feature: keyof Features; value: number }[] {
  const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1
  return FEATURE_KEYS.map((feature, j) => ({ feature, value: values[j] / total })).sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  )
}

export function trainModel(ds: Dataset, kind: ModelKind, opts: TrainOptions = {}): ModelReport | null {
  const spec = MODEL_SPECS[kind]
  const examples = buildExamples(ds, kind)
  const trainSet = examples.filter((e) => !isTest(e.donorId))
  const testSet = examples.filter((e) => isTest(e.donorId))
  if (trainSet.length < 50 || trainSet.filter((e) => e.y).length < 5 || !testSet.some((e) => e.y)) return null

  const X = trainSet.map((e) => e.x)
  const Y = trainSet.map((e) => e.y)
  const y = testSet.map((e) => e.y)

  const logistic = trainLogistic(X, Y, { epochs: opts.epochs, l2: opts.l2 })
  const gbdt = trainGbdt(X, Y, { rounds: opts.rounds, depth: opts.depth })
  const models: TrainedModel[] = [
    { algorithm: 'logistic', model: logistic },
    { algorithm: 'gbdt', model: gbdt },
  ]

  const evaluations = models.map((m) => evaluate(m.algorithm, testSet.map((e) => predictWith(m, e.x)), y, true))
  evaluations[0].importance = normalize(logistic.weights)
  evaluations[1].importance = normalize(gbdt.gain)
  // L'AUC traite les égalités de la règle comme des tirages à pile ou face
  evaluations.push(evaluate('rule', testSet.map((e) => spec.baseline(e.f)), y, false))

  const best = evaluations[0].auc >= evaluations[1].auc ? 'logistic' : 'gbdt'
  const means = X[0].map((_, j) => X.reduce((s, x) => s + x[j], 0) / X.length)

  return {
    kind,
    trainedAt: new Date().toISOString(),
    nTrain: trainSet.length,
    nTest: testSet.length,
    positivesTrain: Y.filter(Boolean).length,
    baseRate: examples.filter((e) => e.y).length / examples.length,
    evaluations,
    selected: opts.force ?? best,
    models,
    means,
  }
}

export function trainAll(ds: Dataset, opts?: TrainOptions): Partial<Record<ModelKind, ModelReport>> {
  const out: Partial<Record<ModelKind, ModelReport>> = {}
  for (const k of MODEL_KINDS) {
    const r = trainModel(ds, k, opts)
    if (r) out[k] = r
  }
  return out
}

const eur = (n: number) => `${Math.round(n)} €`
const pts = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))} pts`

function reasonText(feature: keyof Features, f: Features, high: boolean): string {
  switch (feature) {
    case 'recencyDays':
      return high ? `Dernier don il y a ${f.recencyDays} jours` : `A donné récemment (il y a ${f.recencyDays} j)`
    case 'gifts12m':
      return high ? `${f.gifts12m} dons sur les 12 derniers mois` : `Peu de dons sur 12 mois (${f.gifts12m})`
    case 'amount12m':
      return high ? `A donné ${eur(f.amount12m)} sur 12 mois` : `Montants faibles sur 12 mois (${eur(f.amount12m)})`
    case 'tenureMonths':
      return high ? `Fidèle depuis ${f.tenureMonths} mois` : `Donateur récent (${f.tenureMonths} mois)`
    case 'failed90d':
      return high ? `${f.failed90d} paiement${f.failed90d > 1 ? 's échoués' : ' échoué'} sur 90 jours` : 'Aucun échec de paiement récent'
    case 'openRate3m':
      return high ? `Ouvre ${Math.round(f.openRate3m * 100)} % des emails` : `N'ouvre que ${Math.round(f.openRate3m * 100)} % des emails`
    case 'engagementTrend':
      return high ? `Engagement en hausse (${pts(f.engagementTrend)})` : `Engagement en baisse (${pts(f.engagementTrend)})`
    case 'amountTrend':
      return high ? "Donne plus qu'il y a un an" : "Donne moins qu'il y a un an"
  }
}

const logit = (p: number) => Math.log(Math.max(p, 1e-9) / Math.max(1 - p, 1e-9))

/**
 * Explication locale, valable pour n'importe quel modèle : on remplace chaque variable
 * par sa valeur moyenne et on mesure de combien la prédiction (en logit) change.
 */
export function explain(report: ModelReport, x: number[], f: Features): Reason[] {
  const model = selectedModel(report)
  const base = logit(predictWith(model, x))
  return x
    .map((v, j) => {
      const neutral = [...x]
      neutral[j] = report.means[j]
      return { j, impact: base - logit(predictWith(model, neutral)), high: v > report.means[j] }
    })
    .filter((c) => c.impact > 0.05)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(({ j, impact, high }) => ({ feature: FEATURE_KEYS[j], impact, text: reasonText(FEATURE_KEYS[j], f, high) }))
}

const ACTION_FOR: Record<Segment, ActionType> = {
  monthly: 'churn_prevention',
  one_time: 'upgrade_one_time',
  annual: 'upgrade_annual',
  lapsed: 'reactivation',
}

export const DEFAULT_AUTOMATIONS: Automation[] = [
  { type: 'churn_prevention', enabled: true, threshold: 0.15, requireApproval: true },
  { type: 'upgrade_one_time', enabled: true, threshold: 0.12, requireApproval: true },
  { type: 'upgrade_annual', enabled: true, threshold: 0.12, requireApproval: true },
  { type: 'reactivation', enabled: true, threshold: 0.2, requireApproval: true },
]

/** Score tous les donateurs à la date d'analyse et choisit la meilleure action */
export function scoreAll(
  ds: Dataset,
  reports: Partial<Record<ModelKind, ModelReport>>,
  automations: Automation[] = DEFAULT_AUTOMATIONS,
): DonorScore[] {
  const index = indexDonations(ds.donations)
  const T = ds.refDate
  const out: DonorScore[] = []
  for (const d of ds.donors) {
    const gifts = index.get(d.id) ?? []
    const segment = segmentAt(d, gifts, T)
    if (!segment) continue
    const f = computeFeatures(d, gifts, T, ds.historyStart)
    const x = toVector(f)
    const kind: ModelKind = segment === 'monthly' ? 'churn' : segment === 'lapsed' ? 'reactivation' : 'conversion'
    const report = reports[kind]
    const prob = report ? predictWith(selectedModel(report), x) : 0
    const paid = gifts.filter((g) => g.status === 'paid')
    const avgGift = paid.length ? paid.reduce((s, g) => s + g.amount, 0) / paid.length : 0

    let suggestedMonthly: number | undefined
    let value = 0
    if (segment === 'monthly') {
      value = (d.monthlyAmount ?? avgGift) * 12
    } else if (segment === 'one_time') {
      suggestedMonthly = niceMonthly(Math.min(50, Math.max(5, (f.amount12m / 12) * 1.2 || 10)))
      value = suggestedMonthly * 12
    } else if (segment === 'annual') {
      const lastAnnual = paid.filter((g) => g.kind === 'annual').at(-1)?.amount ?? avgGift
      suggestedMonthly = niceMonthly(Math.min(50, Math.max(5, lastAnnual / 12 + 2)))
      value = suggestedMonthly * 12
    } else {
      value = d.kind === 'monthly' && d.monthlyAmount ? d.monthlyAmount * 12 : avgGift
    }

    const action = ACTION_FOR[segment]
    const auto = automations.find((a) => a.type === action)
    const triggered = report && auto && auto.enabled && prob >= auto.threshold

    out.push({
      donorId: d.id,
      segment,
      features: f,
      churnProb: kind === 'churn' ? prob : undefined,
      conversionProb: kind === 'conversion' ? prob : undefined,
      reactivationProb: kind === 'reactivation' ? prob : undefined,
      action: triggered ? action : undefined,
      actionProb: prob,
      expectedValue: Math.round(value * prob),
      suggestedMonthly,
      reasons: report ? explain(report, x, f) : [],
    })
  }
  return out.sort((a, b) => b.expectedValue - a.expectedValue)
}
