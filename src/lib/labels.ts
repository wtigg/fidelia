import type { ActionType, ModelKind, Segment } from './types.ts'

export const ACTION_LABELS: Record<ActionType, string> = {
  churn_prevention: 'Prévenir le churn',
  upgrade_one_time: 'Ponctuel → mensuel',
  upgrade_annual: 'Annuel → mensuel',
  reactivation: 'Réactiver',
}

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  churn_prevention: "Donateurs mensuels susceptibles d'arrêter leur don dans les 90 jours.",
  upgrade_one_time: 'Donateurs ponctuels prêts à passer au don mensuel.',
  upgrade_annual: 'Donateurs annuels prêts à étaler leur soutien chaque mois.',
  reactivation: 'Anciens donateurs susceptibles de redonner dans les 6 mois.',
}

export const ACTION_MODEL: Record<ActionType, ModelKind> = {
  churn_prevention: 'churn',
  upgrade_one_time: 'conversion',
  upgrade_annual: 'conversion',
  reactivation: 'reactivation',
}

export const ACTION_TONE: Record<ActionType, string> = {
  churn_prevention: 'bg-rose-50 text-rose-700 ring-rose-200',
  upgrade_one_time: 'bg-brand-50 text-brand-700 ring-brand-100',
  upgrade_annual: 'bg-sky-50 text-sky-700 ring-sky-200',
  reactivation: 'bg-amber-50 text-amber-800 ring-amber-200',
}

export const ACTION_COLOR: Record<ActionType, string> = {
  churn_prevention: '#e11d48',
  upgrade_one_time: '#1f7a4d',
  upgrade_annual: '#0284c7',
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
  churn: 'Risque de churn',
  conversion: 'Probabilité de conversion',
  reactivation: 'Probabilité de retour',
}
