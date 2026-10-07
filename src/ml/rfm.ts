/**
 * Règle RFM (récence, fréquence, montant) : la méthode traditionnelle des collecteurs de fonds.
 * Chaque dimension est notée de 1 à 5 par quintile (bornes calculées sur l'entraînement), score = somme (3 à 15).
 */
export interface RfmRule {
  recency: number[]
  frequency: number[]
  monetary: number[]
}

function quintiles(values: number[]): number[] {
  const v = [...values].sort((a, b) => a - b)
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.floor(q * (v.length - 1))])
}

const grade = (edges: number[], x: number) => 1 + edges.filter((e) => x > e).length

export function fitRfm(rows: { recency: number; frequency: number; monetary: number }[]): RfmRule {
  return {
    recency: quintiles(rows.map((r) => r.recency)),
    frequency: quintiles(rows.map((r) => r.frequency)),
    monetary: quintiles(rows.map((r) => r.monetary)),
  }
}

/** Score RFM : plus il est élevé, meilleur est le donateur (récent, fréquent, généreux) */
export function rfmScore(rule: RfmRule, r: { recency: number; frequency: number; monetary: number }): number {
  return 6 - grade(rule.recency, r.recency) + grade(rule.frequency, r.frequency) + grade(rule.monetary, r.monetary)
}
