import { DAY, monthIndex } from '../lib/dates.ts'
import type { Dataset, Donation, Donor, Features, GiftKind, Segment } from '../lib/types.ts'

export const FEATURE_KEYS: (keyof Features)[] = [
  'recencyDays',
  'gifts12m',
  'amount12m',
  'tenureMonths',
  'failed90d',
  'openRate3m',
  'engagementTrend',
  'amountTrend',
]

export const FEATURE_LABELS: Record<keyof Features, string> = {
  recencyDays: 'Jours depuis le dernier don',
  gifts12m: 'Nombre de dons (12 mois)',
  amount12m: 'Montant donné (12 mois)',
  tenureMonths: 'Ancienneté (mois)',
  failed90d: 'Paiements échoués (90 j)',
  openRate3m: "Taux d'ouverture emails (3 mois)",
  engagementTrend: "Tendance d'engagement",
  amountTrend: 'Tendance des montants',
}

/** Index des dons par donateur, triés par date */
export function indexDonations(donations: Donation[]): Map<string, Donation[]> {
  const map = new Map<string, Donation[]>()
  for (const g of donations) {
    const list = map.get(g.donorId)
    if (list) list.push(g)
    else map.set(g.donorId, [g])
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return map
}

/** Type de don du donateur à la date T (avant une éventuelle conversion) */
export function kindAt(d: Donor, T: string): GiftKind {
  if (d.convertedAt) return d.convertedAt <= T ? 'monthly' : (d.convertedFrom ?? 'one_time')
  return d.kind
}

/** Segment du donateur à la date T, ou null s'il n'était pas encore donateur */
export function segmentAt(d: Donor, gifts: Donation[], T: string): Segment | null {
  if (d.joinDate > T) return null
  const kind = kindAt(d, T)
  const last = lastPaidBefore(gifts, T)
  const since = last ? (Date.parse(T) - Date.parse(last.date)) / DAY : Infinity
  if (kind === 'monthly') {
    if (!d.churnDate || d.churnDate > T) return 'monthly'
    // Ancien mensuel revenu avec un don ponctuel : redevient un candidat au mensuel
    return since <= 365 && last && last.date > d.churnDate ? 'one_time' : 'lapsed'
  }
  const limit = kind === 'annual' ? 425 : 365
  return since > limit ? 'lapsed' : kind
}

function lastPaidBefore(gifts: Donation[], T: string): Donation | undefined {
  for (let i = gifts.length - 1; i >= 0; i--) {
    if (gifts[i].date < T && gifts[i].status === 'paid') return gifts[i]
  }
  return undefined
}

function meanValid(values: number[]): number | null {
  const v = values.filter((x) => x >= 0)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

/** Calcule les variables du donateur en n'utilisant QUE les données antérieures à T */
export function computeFeatures(d: Donor, gifts: Donation[], T: string, historyStart: string): Features {
  const t = Date.parse(T)
  const ago = (g: Donation) => (t - Date.parse(g.date)) / DAY
  const before = gifts.filter((g) => g.date < T)
  const paid = before.filter((g) => g.status === 'paid')
  const last = paid[paid.length - 1]
  const in12 = paid.filter((g) => ago(g) <= 365)
  const a6 = paid.filter((g) => ago(g) <= 182).reduce((s, g) => s + g.amount, 0)
  const p6 = paid.filter((g) => ago(g) > 182 && ago(g) <= 365).reduce((s, g) => s + g.amount, 0)

  const mi = monthIndex(new Date(T), new Date(historyStart))
  const eng = d.engagement
  const last3 = meanValid(eng.slice(Math.max(0, mi - 3), Math.max(0, mi)))
  const prev3 = meanValid(eng.slice(Math.max(0, mi - 6), Math.max(0, mi - 3)))

  return {
    recencyDays: last ? Math.round(ago(last)) : Math.round((t - Date.parse(d.joinDate)) / DAY),
    gifts12m: in12.length,
    amount12m: in12.reduce((s, g) => s + g.amount, 0),
    tenureMonths: Math.max(0, Math.round((t - Date.parse(d.joinDate)) / (30.44 * DAY))),
    failed90d: before.filter((g) => g.status === 'failed' && ago(g) <= 90).length,
    openRate3m: last3 ?? 0,
    engagementTrend: last3 !== null && prev3 !== null ? last3 - prev3 : 0,
    amountTrend: Math.log((a6 + 10) / (p6 + 10)),
  }
}

/** Transformation des variables avant normalisation (log pour les variables asymétriques) */
export function toVector(f: Features): number[] {
  return [
    Math.log1p(f.recencyDays),
    f.gifts12m,
    Math.log1p(f.amount12m),
    Math.log1p(f.tenureMonths),
    f.failed90d,
    f.openRate3m,
    f.engagementTrend,
    f.amountTrend,
  ]
}

export function datasetIndex(ds: Dataset) {
  return { gifts: indexDonations(ds.donations) }
}
