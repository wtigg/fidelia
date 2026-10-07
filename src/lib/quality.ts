import type { Dataset } from './types.ts'

/**
 * Contrôles de qualité des données, regroupés selon les dimensions de Strong, Lee et Wang (1997).
 * Seules les dimensions mesurables automatiquement sont calculées ici ; les autres
 * (crédibilité, réputation, interprétabilité…) sont évaluées dans la datasheet.
 */
export interface QualityCheck {
  dimension: 'Complétude' | 'Validité' | 'Unicité' | 'Cohérence' | 'Actualité' | 'Accessibilité'
  label: string
  value: number
  total: number
  /** true = un taux élevé est bon (ex. consentement) */
  higherIsBetter: boolean
  threshold: number
}

export function qualityReport(ds: Dataset): QualityCheck[] {
  const n = ds.donors.length
  const g = ds.donations.length
  const ids = new Set<string>()
  let dupIds = 0
  for (const d of ds.donors) {
    if (ids.has(d.id)) dupIds++
    ids.add(d.id)
  }
  const emails = new Map<string, number>()
  for (const d of ds.donors) if (d.email) emails.set(d.email.toLowerCase(), (emails.get(d.email.toLowerCase()) ?? 0) + 1)
  const dupEmails = [...emails.values()].filter((c) => c > 1).reduce((s, c) => s + c - 1, 0)
  const joinOf = new Map(ds.donors.map((d) => [d.id, d.joinDate]))
  const orphan = ds.donations.filter((x) => !ids.has(x.donorId)).length
  const beforeJoin = ds.donations.filter((x) => joinOf.has(x.donorId) && x.date < (joinOf.get(x.donorId) ?? '')).length
  const future = ds.donations.filter((x) => x.date > ds.refDate).length
  const badAmount = ds.donations.filter((x) => !(x.amount > 0) || x.amount > 100_000).length
  const emailOk = ds.donors.filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)).length
  const withEngagement = ds.donors.filter((d) => d.engagement.some((v) => v >= 0)).length
  const withAge = ds.donors.filter((d) => d.age).length
  const consent = ds.donors.filter((d) => d.emailConsent).length
  const hasMonthly = new Set(ds.donations.filter((x) => x.kind === 'monthly').map((x) => x.donorId))
  const monthlyNoGift = ds.donors.filter((d) => d.kind === 'monthly' && !hasMonthly.has(d.id)).length
  const churnBeforeJoin = ds.donors.filter((d) => d.churnDate && d.churnDate < d.joinDate).length
  const lastDate = ds.donations.reduce((m, x) => (x.date > m ? x.date : m), '')
  const staleDays = lastDate ? Math.max(0, Math.round((Date.parse(ds.refDate) - Date.parse(lastDate)) / 86_400_000)) : 9999

  return [
    { dimension: 'Complétude', label: 'Courriels présents et bien formés', value: emailOk, total: n, higherIsBetter: true, threshold: 0.95 },
    { dimension: 'Complétude', label: "Donateurs avec historique d'ouverture des courriels", value: withEngagement, total: n, higherIsBetter: true, threshold: 0.8 },
    { dimension: 'Complétude', label: "Âge connu (pour l'analyse d'équité seulement)", value: withAge, total: n, higherIsBetter: true, threshold: 0.5 },
    { dimension: 'Validité', label: 'Montants nuls, négatifs ou aberrants', value: badAmount, total: g, higherIsBetter: false, threshold: 0.001 },
    { dimension: 'Validité', label: "Dons datés après la date d'analyse", value: future, total: g, higherIsBetter: false, threshold: 0 },
    { dimension: 'Unicité', label: 'Identifiants de donateurs en double', value: dupIds, total: n, higherIsBetter: false, threshold: 0 },
    { dimension: 'Unicité', label: 'Courriels partagés par plusieurs fiches (doublons probables)', value: dupEmails, total: n, higherIsBetter: false, threshold: 0.01 },
    { dimension: 'Cohérence', label: 'Dons sans donateur correspondant', value: orphan, total: g, higherIsBetter: false, threshold: 0 },
    { dimension: 'Cohérence', label: "Dons antérieurs à la date d'inscription", value: beforeJoin, total: g, higherIsBetter: false, threshold: 0.001 },
    { dimension: 'Cohérence', label: 'Mensuels sans aucun prélèvement / arrêt avant inscription', value: monthlyNoGift + churnBeforeJoin, total: n, higherIsBetter: false, threshold: 0.01 },
    { dimension: 'Actualité', label: `Jours depuis le dernier don enregistré (${lastDate || '—'})`, value: staleDays, total: 1, higherIsBetter: false, threshold: 31 },
    { dimension: 'Accessibilité', label: 'Donateurs ayant consenti aux courriels (Loi 25 / LCAP)', value: consent, total: n, higherIsBetter: true, threshold: 0.7 },
  ]
}

export function isOk(c: QualityCheck): boolean {
  const rate = c.total ? c.value / c.total : c.value
  return c.higherIsBetter ? rate >= c.threshold : rate <= c.threshold
}
