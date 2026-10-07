export type GiftKind = 'monthly' | 'annual' | 'one_time'

export interface Donor {
  id: string
  firstName: string
  lastName: string
  email: string
  city: string
  /** Type de don actuel */
  kind: GiftKind
  status: 'active' | 'lapsed'
  joinDate: string
  /** Date d'arrêt du don mensuel (churn) */
  churnDate?: string
  /** Date de passage au don mensuel */
  convertedAt?: string
  convertedFrom?: GiftKind
  monthlyAmount?: number
  /** Taux d'ouverture email par mois (index 0 = premier mois de l'historique, -1 = pas encore donateur) */
  engagement: number[]
  emailConsent: boolean
  /** Âge (sert uniquement à l'analyse d'équité, jamais comme variable du modèle) */
  age?: number
  /** Canal d'acquisition */
  channel?: Channel
}

export type Channel = 'web' | 'evenement' | 'rue' | 'courrier'

export interface Donation {
  id: string
  donorId: string
  date: string
  amount: number
  kind: GiftKind
  status: 'paid' | 'failed'
}

export interface Dataset {
  donors: Donor[]
  donations: Donation[]
  /** Date d'analyse : les scores sont calculés à cette date */
  refDate: string
  /** Mois correspondant à engagement[0] */
  historyStart: string
  source: 'demo' | 'csv' | 'supabase'
}

export type Segment = 'monthly' | 'one_time' | 'annual' | 'lapsed'

export type ActionType = 'churn_prevention' | 'reactivation' | 'upgrade_annual' | 'upgrade_one_time' | 'upgrade_amount' | 'thank'

export type ModelKind = 'churn' | 'conversion' | 'reactivation' | 'upgrade'

export interface Features {
  recencyDays: number
  gifts12m: number
  amount12m: number
  tenureMonths: number
  failed90d: number
  openRate3m: number
  engagementTrend: number
  amountTrend: number
  giftsLifetime: number
  avgGift: number
  lastGiftRatio: number
  anniversarySoon: number
  emailOptOut: number
  isAnnual: number
  channelWeb: number
  channelEvent: number
  channelStreet: number
  seasonQ4: number
}

export interface Reason {
  feature: keyof Features
  text: string
  /** Contribution au logit (positive = augmente la probabilité) */
  impact: number
}

export interface DonorScore {
  donorId: string
  segment: Segment
  features: Features
  churnProb?: number
  conversionProb?: number
  reactivationProb?: number
  upgradeProb?: number
  /** Raison du remerciement (règle, pas de modèle) */
  thankReason?: string
  action?: ActionType
  /** Probabilité du modèle associé à l'action */
  actionProb: number
  /** Valeur annuelle estimée de l'action en € */
  expectedValue: number
  suggestedMonthly?: number
  reasons: Reason[]
}

export interface CampaignItem {
  id: string
  donorId: string
  type: ActionType
  subject: string
  body: string
  /** 'control' = groupe témoin : volontairement non contacté pour mesurer l'effet réel */
  status: 'draft' | 'approved' | 'sent' | 'dismissed' | 'control'
  createdAt: string
  sentAt?: string
  /** 'auto' = envoyé par une automatisation sans validation */
  origin: 'manual' | 'auto'
}

export interface Automation {
  type: ActionType
  enabled: boolean
  /** Probabilité minimale pour déclencher l'action */
  threshold: number
  requireApproval: boolean
}
