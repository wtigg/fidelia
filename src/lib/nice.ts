const NICE_MONTHLY = [5, 8, 10, 15, 20, 25, 30, 40, 50]

/** Arrondit un montant mensuel à une valeur « ronde » proposable à un donateur */
export function niceMonthly(x: number): number {
  return NICE_MONTHLY.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), NICE_MONTHLY[0])
}
