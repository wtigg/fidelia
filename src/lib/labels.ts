import { fx } from './dates.ts'
import type { ActionType, ModelKind, Segment } from './types.ts'

/** Seuil lisible : « 4,3 % » sous 10 % quand il a une décimale, sinon « 12 % » */
export const thresholdText = (t: number) => `${fx(t * 100, t < 0.1 && Math.round(t * 1000) % 10 ? 1 : 0)} %`

export const ACTION_TYPES: ActionType[] = ['churn_prevention', 'upgrade_amount', 'upgrade_one_time', 'upgrade_annual', 'reactivation', 'thank']

export const ACTION_LABELS: Record<ActionType, string> = {
  churn_prevention: "Relancer (risque d'arrêt)",
  upgrade_amount: 'Solliciter plus',
  upgrade_one_time: 'Ponctuel → mensuel',
  upgrade_annual: 'Annuel → mensuel',
  reactivation: 'Réactiver',
  thank: 'Remercier',
}

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  churn_prevention: "Donateurs mensuels susceptibles d'arrêter leur don dans les 90 jours.",
  upgrade_amount: 'Donateurs mensuels fidèles, prêts à augmenter leur don.',
  upgrade_one_time: 'Donateurs ponctuels prêts à passer au don mensuel.',
  upgrade_annual: 'Donateurs annuels prêts à étaler leur soutien chaque mois.',
  reactivation: 'Anciens donateurs susceptibles de redonner dans les 6 mois.',
  thank: 'Nouveau donateur, don inhabituel ou anniversaire : remercier avant de solliciter (règle simple, sans IA).',
}

export const ACTION_MODEL: Record<ActionType, ModelKind | null> = {
  churn_prevention: 'churn',
  upgrade_amount: 'upgrade',
  upgrade_one_time: 'conversion',
  upgrade_annual: 'conversion',
  reactivation: 'reactivation',
  thank: null,
}

export const ACTION_TONE: Record<ActionType, string> = {
  churn_prevention: 'bg-rose-50 text-rose-700 ring-rose-200',
  upgrade_amount: 'bg-violet-50 text-violet-700 ring-violet-200',
  upgrade_one_time: 'bg-brand-50 text-brand-700 ring-brand-100',
  upgrade_annual: 'bg-sky-50 text-sky-700 ring-sky-200',
  reactivation: 'bg-amber-50 text-amber-800 ring-amber-200',
  thank: 'bg-pink-50 text-pink-700 ring-pink-200',
}

export const ACTION_COLOR: Record<ActionType, string> = {
  churn_prevention: '#e11d48',
  upgrade_amount: '#7c3aed',
  upgrade_one_time: '#1f7a4d',
  upgrade_annual: '#0284c7',
  reactivation: '#d97706',
  thank: '#db2777',
}

export const MODEL_COLOR: Record<ModelKind, string> = {
  churn: '#e11d48',
  upgrade: '#7c3aed',
  conversion: '#1f7a4d',
  reactivation: '#d97706',
}

export const SEGMENT_LABELS: Record<Segment, string> = {
  monthly: 'Mensuel',
  one_time: 'Ponctuel',
  annual: 'Annuel',
  lapsed: 'Inactif',
}

export const SEGMENT_TONE: Record<Segment, string> = {
  monthly: 'bg-brand-50 text-brand-700 ring-brand-100',
  one_time: 'bg-stone-100 text-stone-700 ring-stone-200',
  annual: 'bg-sky-50 text-sky-700 ring-sky-200',
  lapsed: 'bg-stone-50 text-stone-500 ring-stone-200',
}

export const PROB_LABEL: Record<ModelKind, string> = {
  churn: "Risque d'arrêter son don mensuel (90 prochains jours)",
  upgrade: "Chance d'augmenter son don mensuel (6 prochains mois)",
  conversion: 'Chance de passer au don mensuel (6 prochains mois)',
  reactivation: 'Chance de redonner (6 prochains mois)',
}

/** Mot affiché à côté d'un pourcentage : un risque (départ) ou une chance (hausse, passage, retour) */
export const PROB_WORD = (action?: ActionType | null): 'risque' | 'chance' => (action === 'churn_prevention' ? 'risque' : 'chance')

/** Définition des segments, en mots simples (infobulle) */
export const SEGMENT_HELP: Record<Segment, string> = {
  monthly: 'Donne chaque mois, prélèvement en cours.',
  one_time: 'A donné au moins une fois dans les 12 derniers mois, sans don mensuel.',
  annual: 'Donne une fois par an, à la même période.',
  lapsed: 'Inactif : a arrêté son don mensuel, ou aucun don depuis 12 mois (13 mois pour un annuel). Un ancien mensuel peut donc être inactif malgré un dernier prélèvement récent.',
}
