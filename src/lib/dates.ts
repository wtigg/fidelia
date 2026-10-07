/** Date de référence de la démo (fixe pour des résultats reproductibles) */
export const REF_DATE = new Date('2026-10-01T00:00:00Z')
export const HISTORY_MONTHS = 36
export const HISTORY_START = addMonths(REF_DATE, -HISTORY_MONTHS)

export const DAY = 86_400_000

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + n)
  return r
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY)
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

/** Index du mois dans l'historique (0 = mois de départ) */
export function monthIndex(d: Date, start: Date = HISTORY_START): number {
  return (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth()
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export function formatDate(s: string): string {
  return fmt.format(new Date(s))
}

const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 })
export function formatPct(n: number): string {
  return pct.format(n)
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export function formatEur(n: number): string {
  return eur.format(n)
}
