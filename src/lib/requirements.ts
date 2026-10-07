import type { Evaluation } from '../ml/experiment.ts'
import type { ModelReport } from '../ml/pipeline.ts'
import { fx } from './dates.ts'

/**
 * Requis de performance fixés AVANT de regarder les résultats (consigne du cours : « métrique(s), valeur(s) désirée(s) »).
 * Chaque requis est relié à une justification d'affaires.
 */
export interface Requirement {
  id: string
  label: string
  why: string
  check: (r: ModelReport) => { ok: boolean; value: string }
}

/** Les requis évaluent le meilleur modèle d'IA candidat (choisi sur la validation), pas la règle de repli */
const sel = (r: ModelReport) => r.evaluations.find((e) => e.algorithm === r.selected) as Evaluation
const rfm = (r: ModelReport) => r.evaluations.find((e) => e.algorithm === 'rfm') as Evaluation
const pct = (v: number) => `${fx(v * 100, 1)} %`

export const REQUIREMENTS: Requirement[] = [
  {
    id: 'R1',
    label: 'Mieux que le hasard : AUC-PR ≥ 2 × taux de base',
    why: 'Sinon, contacter des donateurs au hasard ferait presque aussi bien.',
    check: (r) => ({ ok: sel(r).ap >= 2 * r.baseRate, value: `${fx(sel(r).ap, 3)} vs ${fx((2 * r.baseRate), 3)}` }),
  },
  {
    id: 'R2',
    label: 'Mieux que la règle RFM : écart d\'AUC-PR > 0 avec 95 % de confiance (bootstrap apparié)',
    why: "L'IA n'est justifiée que si elle bat la méthode traditionnelle des collecteurs de fonds, de façon statistiquement significative.",
    check: (r) => {
      const ci = sel(r).apDiffVsRfmCI
      return ci ? { ok: ci[0] > 0, value: `écart ${fx(sel(r).ap - rfm(r).ap, 3)} [${ci.map((v) => fx(v, 3)).join(' ; ')}]` } : { ok: sel(r).apCI[0] > rfm(r).apCI[1], value: 'IC séparés' }
    },
  },
  {
    id: 'R3',
    label: 'Les 50 premiers noms : précision@50 ≥ règle RFM',
    why: 'Une petite équipe ne contacte que quelques dizaines de personnes par semaine.',
    check: (r) => ({ ok: sel(r).p50 >= rfm(r).p50, value: `${pct(sel(r).p50)} vs ${pct(rfm(r).p50)}` }),
  },
  {
    id: 'R4',
    label: 'Probabilités fiables : score de Brier < celui d\'une prédiction constante',
    why: 'La valeur attendue (probabilité × montant) suppose des probabilités calibrées.',
    check: (r) => {
      const constant = r.baseRate * (1 - r.baseRate)
      return { ok: (sel(r).brier ?? 1) < constant, value: `${fx((sel(r).brier ?? 0), 4)} vs ${fx(constant, 4)}` }
    },
  },
  {
    id: 'R5',
    label: 'Stable dans le temps : AUC du test temporel ≥ AUC du test − 0,05',
    why: 'Le modèle doit rester valable sur des périodes futures (dérive).',
    check: (r) => (r.temporal ? { ok: r.temporal.auc >= sel(r).auc - 0.05, value: `${fx(r.temporal.auc, 3)} vs ${fx(sel(r).auc, 3)}` } : { ok: false, value: 'non mesuré' }),
  },
  {
    id: 'R6',
    label: 'Équité : calibré dans chaque tranche d\'âge (prédit / observé entre 0,67 et 1,5)',
    why: 'Le modèle ne doit sur-estimer ni sous-estimer aucun groupe : sinon on sur-sollicite ou on ignore une population (Loi 25, sources de tort).',
    check: (r) => {
      const groups = r.fairness.find((f) => f.by === 'age')?.groups.filter((g) => g.group !== 'Inconnu' && g.n >= 100 && g.baseRate * g.n >= 5) ?? []
      const ratio = (g: { meanPred: number; baseRate: number }) => g.meanPred / g.baseRate
      const bad = groups.filter((g) => ratio(g) < 0.67 || ratio(g) > 1.5)
      return { ok: groups.length > 0 && !bad.length, value: bad.length ? bad.map((g) => `${g.group} ${fx(ratio(g), 2)}`).join(', ') : groups.map((g) => fx(ratio(g), 2)).join(' · ') }
    },
  },
]
