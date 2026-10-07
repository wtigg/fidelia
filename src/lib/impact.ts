import type { DonorScore, ModelKind } from './types.ts'
import type { ModelReport } from '../ml/pipeline.ts'

/**
 * Estimation de l'impact d'une campagne.
 * - Valeur en jeu : somme des probabilités × valeur, sur les donateurs actuels (probabilités calibrées, cf. score de Brier).
 * - Part captée en contactant une fraction f du segment : lue sur la courbe de valeur MESURÉE sur le jeu de test
 *   (modèle, règle RFM ou hasard).
 * - Effet de l'action : HYPOTHÈSE explicite (part des cas visés que l'action change vraiment), à mesurer en production
 *   avec un groupe témoin.
 */
export const DEFAULT_EFFECT: Record<ModelKind, number> = { churn: 0.3, upgrade: 0.25, conversion: 0.15, reactivation: 0.15 }

export const KIND_OF_SEGMENT = (s: DonorScore): ModelKind[] =>
  s.segment === 'monthly' ? ['churn', 'upgrade'] : s.segment === 'lapsed' ? ['reactivation'] : ['conversion']

function interpolate(curve: { x: number; y: number }[] | undefined, f: number): number {
  if (!curve?.length) return f
  if (f <= 0) return 0
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].x >= f) {
      const a = curve[i - 1]
      const b = curve[i]
      return a.y + ((b.y - a.y) * (f - a.x)) / (b.x - a.x || 1)
    }
  }
  return 1
}

export interface ImpactLine {
  kind: ModelKind
  population: number
  atStake: number
  contacted: number
  model: number
  rfm: number
  random: number
}

export function valueAtStake(scores: DonorScore[], kind: ModelKind): { population: number; atStake: number } {
  let population = 0
  let atStake = 0
  for (const s of scores) {
    if (!KIND_OF_SEGMENT(s).includes(kind)) continue
    population++
    const p = kind === 'churn' ? s.churnProb : kind === 'upgrade' ? s.upgradeProb : kind === 'conversion' ? s.conversionProb : s.reactivationProb
    if (p === undefined) continue
    // valeur annuelle si le cas se réalise
    const value = kind === 'churn' || kind === 'upgrade' ? valueMonthly(s, kind) : s.expectedValue / Math.max(s.actionProb, 1e-9)
    atStake += p * value
  }
  return { population, atStake }
}

function valueMonthly(s: DonorScore, kind: ModelKind): number {
  const f = s.features
  const monthly = f.giftsLifetime ? f.amount12m / Math.max(1, f.gifts12m) : 0
  return kind === 'churn' ? monthly * 12 : (monthly >= 30 ? 10 : 5) * 12
}

export function simulate(
  scores: DonorScore[],
  reports: Partial<Record<ModelKind, ModelReport>>,
  capacity: number,
  effect: Record<ModelKind, number>,
): ImpactLine[] {
  const kinds = (Object.keys(reports) as ModelKind[]).filter((k) => reports[k])
  const base = kinds.map((k) => ({ kind: k, ...valueAtStake(scores, k) }))
  const totalStake = base.reduce((s, b) => s + b.atStake, 0) || 1
  return base.map((b) => {
    const r = reports[b.kind]!
    const sel = r.evaluations.find((e) => e.algorithm === r.deployed)
    const rfm = r.evaluations.find((e) => e.algorithm === 'rfm')
    const contacted = Math.min(b.population, Math.round((capacity * b.atStake) / totalStake))
    const f = b.population ? contacted / b.population : 0
    const e = effect[b.kind]
    return {
      ...b,
      contacted,
      model: b.atStake * interpolate(sel?.valueGain ?? sel?.gain, f) * e,
      rfm: b.atStake * interpolate(rfm?.valueGain ?? rfm?.gain, f) * e,
      random: b.atStake * f * e,
    }
  })
}
