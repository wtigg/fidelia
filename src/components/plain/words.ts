import type { ModelKind } from '../../lib/types.ts'

/** Qui chaque modèle cherche, en mots simples. */
export const WHO: Record<ModelKind, string> = {
  churn: 'les donateurs mensuels sur le point de partir',
  upgrade: 'les donateurs mensuels prêts à donner plus',
  conversion: 'les donateurs prêts à passer au don mensuel',
  reactivation: 'les anciens donateurs prêts à revenir',
}

/** « 2,7 » à partir d'un ratio ; null si le modèle ne fait pas mieux. */
export function times(ratio: number): string | null {
  if (!Number.isFinite(ratio)) return null
  const r = Math.round(ratio * 10) / 10
  if (r <= 1) return null
  return r.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}
