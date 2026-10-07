import { DAY, monthIndex } from '../lib/dates.ts'
import type { Dataset, Donation, Donor, Features, GiftKind, Segment } from '../lib/types.ts'

export const FEATURE_KEYS: (keyof Features)[] = [
  'recencyDays', 'gifts12m', 'amount12m', 'tenureMonths', 'failed90d', 'openRate3m', 'engagementTrend', 'amountTrend',
  'giftsLifetime', 'avgGift', 'lastGiftRatio', 'anniversarySoon', 'emailOptOut', 'isAnnual', 'channelWeb', 'channelEvent', 'channelStreet', 'seasonQ4',
]

export const FEATURE_LABELS: Record<keyof Features, string> = {
  recencyDays: 'Jours depuis le dernier don',
  gifts12m: 'Nombre de dons (12 mois)',
  amount12m: 'Montant donné (12 mois)',
  tenureMonths: 'Ancienneté (mois)',
  failed90d: 'Paiements échoués (90 j)',
  openRate3m: 'Taux d\'ouverture des courriels (3 mois)',
  engagementTrend: 'Tendance d\'engagement',
  amountTrend: 'Tendance des montants',
  giftsLifetime: 'Nombre de dons (depuis le début)',
  avgGift: 'Don moyen',
  lastGiftRatio: 'Dernier don / don moyen',
  anniversarySoon: 'Date anniversaire du don annuel proche',
  emailOptOut: 'Pas de consentement courriel',
  isAnnual: 'Donateur annuel',
  channelWeb: 'Recruté en ligne',
  channelEvent: 'Recruté lors d\'un événement',
  channelStreet: 'Recruté dans la rue',
  seasonQ4: 'Décembre dans l\'horizon de prédiction',
}

/** Famille de chaque variable, pour la documentation (datasheet) */
export const FEATURE_GROUPS: Record<keyof Features, 'Récence-fréquence-montant' | 'Paiement' | 'Engagement' | 'Profil' | 'Contexte'> = {
  recencyDays: 'Récence-fréquence-montant', gifts12m: 'Récence-fréquence-montant', amount12m: 'Récence-fréquence-montant',
  giftsLifetime: 'Récence-fréquence-montant', avgGift: 'Récence-fréquence-montant', lastGiftRatio: 'Récence-fréquence-montant',
  amountTrend: 'Récence-fréquence-montant', tenureMonths: 'Profil', failed90d: 'Paiement', openRate3m: 'Engagement',
  engagementTrend: 'Engagement', emailOptOut: 'Engagement', anniversarySoon: 'Contexte', isAnnual: 'Profil',
  channelWeb: 'Profil', channelEvent: 'Profil', channelStreet: 'Profil', seasonQ4: 'Contexte',
}

/** Taux d'ouverture imputé quand il n'y a pas de donnée (pas de consentement) */
export const OPEN_RATE_IMPUTED = 0.3

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

export function kindAt(d: Donor, T: string): GiftKind {
  if (d.convertedAt) return d.convertedAt <= T ? 'monthly' : (d.convertedFrom ?? 'one_time')
  return d.kind
}

function lastPaidBefore(gifts: Donation[], T: string): Donation | undefined {
  for (let i = gifts.length - 1; i >= 0; i--) if (gifts[i].date < T && gifts[i].status === 'paid') return gifts[i]
  return undefined
}

/** Segment à la date T. Inactif = mensuel arrêté, ou ponctuel sans don depuis 12 mois (13 mois pour un annuel) */
export function segmentAt(d: Donor, gifts: Donation[], T: string): Segment | null {
  // inscrit à T ou après : pas encore donateur à la date de la photo (sinon son premier don devient une « réactivation »)
  if (d.joinDate >= T) return null
  const kind = kindAt(d, T)
  const last = lastPaidBefore(gifts, T)
  const since = last ? (Date.parse(T) - Date.parse(last.date)) / DAY : Infinity
  if (kind === 'monthly') {
    if (!d.churnDate || d.churnDate > T) return 'monthly'
    return since <= 365 && last && last.date > d.churnDate ? 'one_time' : 'lapsed'
  }
  return since > (kind === 'annual' ? 395 : 365) ? 'lapsed' : kind
}

/** Montant du don mensuel en vigueur à la date T (dernier prélèvement) */
export function monthlyAmountAt(gifts: Donation[], T: string): number | undefined {
  for (let i = gifts.length - 1; i >= 0; i--) if (gifts[i].date < T && gifts[i].kind === 'monthly') return gifts[i].amount
  return undefined
}

function meanValid(values: number[]): number | null {
  const v = values.filter((x) => x >= 0)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

/** Variables du donateur calculées uniquement avec les données antérieures à T (pas de fuite du futur) */
export function computeFeatures(d: Donor, gifts: Donation[], T: string, historyStart: string): Features {
  const t = Date.parse(T)
  const ago = (g: Donation) => (t - Date.parse(g.date)) / DAY
  const before = gifts.filter((g) => g.date < T)
  const paid = before.filter((g) => g.status === 'paid')
  const last = paid[paid.length - 1]
  const in12 = paid.filter((g) => ago(g) <= 365)
  const a6 = paid.filter((g) => ago(g) <= 182).reduce((s, g) => s + g.amount, 0)
  const p6 = paid.filter((g) => ago(g) > 182 && ago(g) <= 365).reduce((s, g) => s + g.amount, 0)
  const avg = paid.length ? paid.reduce((s, g) => s + g.amount, 0) / paid.length : 0
  const prevAvg = paid.length > 1 ? paid.slice(0, -1).reduce((s, g) => s + g.amount, 0) / (paid.length - 1) : avg

  const mi = monthIndex(new Date(T), new Date(historyStart))
  const last3 = meanValid(d.engagement.slice(Math.max(0, mi - 3), Math.max(0, mi)))
  const prev3 = meanValid(d.engagement.slice(Math.max(0, mi - 6), Math.max(0, mi - 3)))
  const kind = kindAt(d, T)
  const monthsSinceJoin = (t - Date.parse(d.joinDate)) / (30.44 * DAY)
  const monthT = new Date(T).getUTCMonth()

  return {
    recencyDays: last ? Math.round(ago(last)) : Math.round(monthsSinceJoin * 30.44),
    gifts12m: in12.length,
    amount12m: in12.reduce((s, g) => s + g.amount, 0),
    tenureMonths: Math.max(0, Math.round(monthsSinceJoin)),
    failed90d: before.filter((g) => g.status === 'failed' && ago(g) <= 90).length,
    openRate3m: last3 ?? OPEN_RATE_IMPUTED,
    engagementTrend: last3 !== null && prev3 !== null ? last3 - prev3 : 0,
    amountTrend: Math.log((a6 + 10) / (p6 + 10)),
    giftsLifetime: paid.length,
    avgGift: Math.round(avg),
    lastGiftRatio: last ? Math.log((last.amount + 1) / (prevAvg + 1)) : 0,
    anniversarySoon: kind === 'annual' && 12 - (Math.floor(monthsSinceJoin) % 12) <= 3 ? 1 : 0,
    emailOptOut: last3 === null ? 1 : 0,
    isAnnual: kind === 'annual' ? 1 : 0,
    channelWeb: d.channel === 'web' ? 1 : 0,
    channelEvent: d.channel === 'evenement' ? 1 : 0,
    channelStreet: d.channel === 'rue' ? 1 : 0,
    seasonQ4: monthT >= 6 ? 1 : 0,
  }
}

/** Transformation avant apprentissage : logarithme des variables très asymétriques */
export function toVector(f: Features): number[] {
  return FEATURE_KEYS.map((k) =>
    k === 'recencyDays' || k === 'amount12m' || k === 'tenureMonths' || k === 'giftsLifetime' || k === 'avgGift' ? Math.log1p(f[k]) : f[k],
  )
}

export function datasetIndex(ds: Dataset) {
  return { gifts: indexDonations(ds.donations) }
}

const REGIONS: Record<string, string> = {
  Montréal: 'Montréal', Laval: 'Couronne de Montréal', Longueuil: 'Couronne de Montréal', Terrebonne: 'Couronne de Montréal',
  Brossard: 'Couronne de Montréal', 'Saint-Jérôme': 'Couronne de Montréal', Québec: 'Capitale-Nationale', Lévis: 'Capitale-Nationale',
}
export const regionOf = (city: string) => REGIONS[city] ?? 'Autres régions'

export function ageBandOf(age?: number): string {
  if (!age) return 'Inconnu'
  return age < 35 ? 'Moins de 35 ans' : age < 55 ? '35 à 54 ans' : age < 70 ? '55 à 69 ans' : '70 ans et plus'
}
