import type { ActionType, ModelKind, Segment } from './types.ts'

export const ACTION_TYPES: ActionType[] = ['churn_prevention', 'upgrade_amount', 'upgrade_one_time', 'upgrade_annual', 'reactivation', 'thank']

export const ACTION_LABELS: Record<ActionType, string> = {
  churn_prevention: 'Relancer (attrition)',
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
  churn: "Risque d'attrition (90 j)",
  upgrade: 'Probabilité de hausse (6 mois)',
  conversion: 'Probabilité de passage au mensuel (6 mois)',
  reactivation: 'Probabilité de retour (6 mois)',
}
