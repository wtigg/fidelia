// Vérifie que le jeu synthétique reproduit des ordres de grandeur publiés : npm run calibration
import { generateDemo } from '../src/data/generate.ts'
import { HISTORY_START, addMonths, iso } from '../src/lib/dates.ts'

export function calibrationStats(seed = 42, count = 2500) {
  const ds = generateDemo(count, seed)
  const at = (m: number) => iso(addMonths(HISTORY_START, m))
  const A = [at(24), at(36)] // année N-1
  const B = [at(36), at(48)] // année N
  const paid = ds.donations.filter((g) => g.status === 'paid')
  const giversIn = (w: string[]) => new Set(paid.filter((g) => g.date >= w[0] && g.date < w[1]).map((g) => g.donorId))
  const first = new Map<string, string>()
  for (const g of paid) if (!first.has(g.donorId)) first.set(g.donorId, g.date)
  const a = giversIn(A)
  const b = giversIn(B)
  const retained = [...a].filter((d) => b.has(d))
  const isNew = (d: string) => (first.get(d) ?? '') >= A[0]
  const newA = [...a].filter(isNew)
  const repA = [...a].filter((d) => !isNew(d))
  const monthlyA = ds.donors.filter((d) => (d.convertedAt ?? d.joinDate) < A[1] && (d.kind === 'monthly') && (!d.churnDate || d.churnDate >= A[1]))
  const monthlyKept = monthlyA.filter((d) => !d.churnDate || d.churnDate >= B[1])
  const oneTimeA = ds.donors.filter((d) => a.has(d.id) && d.kind !== 'monthly' || (d.convertedAt && d.convertedAt >= B[0] && a.has(d.id)))
  const convertedB = ds.donors.filter((d) => d.convertedAt && d.convertedAt >= B[0] && d.convertedAt < B[1])
  const revenueB = paid.filter((g) => g.date >= B[0] && g.date < B[1])
  const monthlyRevenue = revenueB.filter((g) => g.kind === 'monthly').reduce((s, g) => s + g.amount, 0)
  const total = revenueB.reduce((s, g) => s + g.amount, 0)
  const dec = revenueB.filter((g) => g.kind === 'one_time' && g.date.slice(5, 7) === '12').length
  const oneTime = revenueB.filter((g) => g.kind === 'one_time').length
  return {
    donorsGivingN1: a.size,
    retentionOverall: retained.length / a.size,
    retentionNew: newA.filter((d) => b.has(d)).length / newA.length,
    retentionRepeat: repA.filter((d) => b.has(d)).length / repA.length,
    monthlyRetention12m: monthlyKept.length / monthlyA.length,
    conversionsPerYear: convertedB.length / Math.max(1, oneTimeA.length),
    monthlyShareOfRevenue: monthlyRevenue / total,
    decemberShareOfOneTimeGifts: dec / oneTime,
    failedPaymentRate: ds.donations.filter((g) => g.kind === 'monthly' && g.status === 'failed').length / ds.donations.filter((g) => g.kind === 'monthly').length,
  }
}

if (process.argv[1]?.endsWith('calibration.ts')) {
  const s = calibrationStats()
  const fmt = (v: number) => `${(v * 100).toFixed(1)} %`
  console.log(`Donateurs ayant donné en N-1 : ${s.donorsGivingN1}`)
  console.log(`Rétention globale N-1 → N        ${fmt(s.retentionOverall)}   (cible FEP 2025 : 43,3 %)`)
  console.log(`Rétention des nouveaux donateurs ${fmt(s.retentionNew)}   (ordre de grandeur publié : ~20 %)`)
  console.log(`Rétention des donateurs réguliers ${fmt(s.retentionRepeat)}  (ordre de grandeur publié : 60-70 %)`)
  console.log(`Rétention des mensuels sur 12 mois ${fmt(s.monthlyRetention12m)} (ordre de grandeur : 75-85 %)`)
  console.log(`Conversions au mensuel par an    ${fmt(s.conversionsPerYear)}`)
  console.log(`Part des revenus en mensuel      ${fmt(s.monthlyShareOfRevenue)}`)
  console.log(`Part des dons ponctuels en décembre ${fmt(s.decemberShareOfOneTimeGifts)}`)
  console.log(`Taux d'échec des prélèvements    ${fmt(s.failedPaymentRate)}`)
}
