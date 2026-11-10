import type { ActionType, DonorScore } from './types.ts'

/** Donateurs concernés par une action : on compte l'action FINALE retenue pour chacun (une seule par donateur).
 *  Même définition partout (tableau de bord, Automatisations, Recommandations) pour que les chiffres concordent. */
export function donorsForAction(scores: DonorScore[], type: ActionType): DonorScore[] {
  return scores.filter((s) => s.action === type)
}

/** Nombre de donateurs et dons espérés sur un an pour une action (somme des valeurs espérées). */
export function actionStats(scores: DonorScore[], type: ActionType): { count: number; value: number } {
  const list = donorsForAction(scores, type)
  return { count: list.length, value: list.reduce((s, x) => s + x.expectedValue, 0) }
}
