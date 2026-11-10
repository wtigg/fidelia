import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { generateDemo } from '../data/generate.ts'
import { draftEmail } from '../lib/emails.ts'
import type { ActionType, Automation, CampaignItem, Dataset, Donor, DonorScore, ModelKind } from '../lib/types.ts'
import { DEFAULT_AUTOMATIONS, scoreAll, type Algorithm, type ModelReport } from '../ml/pipeline.ts'
import type { TrainMessage, TrainRequest } from '../ml/worker.ts'
import bundled from '../data/model.json'

/** Modèle pré-entraîné et versionné (npm run train), chargé instantanément pour le jeu de démonstration */
const BUNDLED = bundled as unknown as { version: string; trainedAt: string; reports: Partial<Record<ModelKind, ModelReport>> }

type Reports = Partial<Record<ModelKind, ModelReport>>
export type AlgoChoice = 'auto' | Algorithm

/** Plafond de sollicitation : un donateur ne reçoit pas plus d'un courriel par période */
export const CONTACT_COOLDOWN_DAYS = 30
/** Part des donateurs ciblés gardés sans contact pour mesurer l'effet réel des actions */
export const CONTROL_SHARE = 0.1

interface Store {
  dataset: Dataset
  donorsById: Map<string, Donor>
  reports: Reports
  training: boolean
  trainingStep?: ModelKind
  trainMs?: number
  /** Échec de l'entraînement (CSV trop petit ou mal formé) : message en français */
  trainError?: string
  /** Modèles non entraînés faute d'exemples : aucun score pour ces actions */
  trainSkipped: ModelKind[]
  scores: DonorScore[]
  scoresById: Map<string, DonorScore>
  automations: Automation[]
  campaign: CampaignItem[]
  algoChoice: Record<ModelKind, AlgoChoice>
  modelVersion: string
  /** Date de l'entraînement du modèle (ISO), distincte de la date des données */
  modelTrainedAt: string
  retrain: () => void
  setAlgo: (kind: ModelKind, choice: AlgoChoice) => void
  loadDataset: (ds: Dataset) => void
  setAutomation: (type: ActionType, patch: Partial<Automation>) => void
  createDrafts: (donorIds: string[]) => { drafted: number; control: number }
  updateItem: (id: string, patch: Partial<CampaignItem>) => void
  sendItems: (ids: string[]) => number
  runCycle: () => { drafted: number; sent: number; skipped: number; control: number }
  resetCampaign: () => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`fidelia:v2:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`fidelia:v2:${key}`, JSON.stringify(value))
  } catch {
    // stockage indisponible : l'état reste en mémoire
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(() => generateDemo())
  const [rawReports, setRawReports] = useState<Reports>(BUNDLED.reports)
  const [training, setTraining] = useState(false)
  const [version, setVersion] = useState(BUNDLED.version)
  const [trainedAt, setTrainedAt] = useState(BUNDLED.trainedAt)
  const [trainingStep, setTrainingStep] = useState<ModelKind>()
  const [trainMs, setTrainMs] = useState<number>()
  const [trainError, setTrainError] = useState<string>()
  const [trainSkipped, setTrainSkipped] = useState<ModelKind[]>([])
  const [automations, setAutomations] = useState<Automation[]>(() => {
    // clé « automations-2 » : les réglages enregistrés avant le nouveau seuil de « Solliciter plus » (10 %, liste vide) sont ignorés
    const saved = load<Automation[]>('automations-2', DEFAULT_AUTOMATIONS)
    return DEFAULT_AUTOMATIONS.map((d) => saved.find((s) => s.type === d.type) ?? d)
  })
  const [campaign, setCampaign] = useState<CampaignItem[]>(() => load('campaign', []))
  // Choix d'algorithme gardé en mémoire seulement : chaque ouverture repart de la décision automatique (gouvernance R1/R2)
  const [algoChoice, setAlgoChoice] = useState<Record<ModelKind, AlgoChoice>>({ churn: 'auto', upgrade: 'auto', conversion: 'auto', reactivation: 'auto' })
  const worker = useRef<Worker | null>(null)

  useEffect(() => save('automations-2', automations), [automations])
  useEffect(() => save('campaign', campaign), [campaign])
  useEffect(() => {
    try {
      localStorage.removeItem('fidelia:v2:algo') // ancienne version : choix persistant
    } catch {
      // stockage indisponible
    }
  }, [])

  // Un worker par entraînement : le calcul ne bloque pas l'interface
  const train = useCallback((ds: Dataset) => {
    worker.current?.terminate()
    const w = new Worker(new URL('../ml/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    const fail = (message: string) => {
      setTrainError(message)
      setTraining(false)
      setTrainingStep(undefined)
      w.terminate()
    }
    w.onerror = (e) => {
      e.preventDefault()
      fail(e.message || 'erreur inconnue')
    }
    w.onmessage = (e: MessageEvent<TrainMessage>) => {
      if (e.data.type === 'progress') {
        setTrainingStep(e.data.kind)
        return
      }
      if (e.data.type === 'error') {
        fail(e.data.message)
        return
      }
      setRawReports(e.data.reports)
      setTrainSkipped(e.data.skipped)
      setTrainMs(e.data.ms)
      const t = new Date().toISOString()
      setTrainedAt(t)
      setVersion(`v${t.slice(0, 10).replace(/-/g, '')}.${t.slice(11, 16).replace(':', '')}-local`)
      setTraining(false)
      setTrainingStep(undefined)
      w.terminate()
    }
    // Les rapports de l'ancien jeu ne valent pas pour le nouveau : aucun score tant que l'entraînement n'est pas fini
    setRawReports({})
    setTrainError(undefined)
    setTrainSkipped([])
    setTraining(true)
    const msg: TrainRequest = { dataset: ds }
    w.postMessage(msg)
  }, [])

  // Le jeu de démonstration utilise le modèle versionné ; tout autre jeu (import CSV, autre graine) est réentraîné
  const initial = useRef(dataset)
  useEffect(() => {
    if (dataset !== initial.current) train(dataset)
    return () => worker.current?.terminate()
  }, [dataset, train])

  // Le choix d'algorithme s'applique sans réentraîner : les trois variantes sont déjà entraînées
  const reports = useMemo(() => {
    const out: Reports = {}
    for (const [k, r] of Object.entries(rawReports) as [ModelKind, ModelReport][]) {
      const c = algoChoice[k] ?? 'auto'
      out[k] = c === 'auto' ? r : { ...r, deployed: c, deployedAuto: false }
    }
    return out
  }, [rawReports, algoChoice])

  const modelVersion = version

  const scores = useMemo(() => (Object.keys(reports).length ? scoreAll(dataset, reports, automations) : []), [dataset, reports, automations])
  const scoresById = useMemo(() => new Map(scores.map((s) => [s.donorId, s])), [scores])
  const donorsById = useMemo(() => new Map(dataset.donors.map((d) => [d.id, d])), [dataset])

  const makeDrafts = useCallback(
    (ids: string[], existing: CampaignItem[], origin: CampaignItem['origin']): { items: CampaignItem[]; skipped: number } => {
      // un donateur du groupe témoin n'est jamais recontacté, même à la main
      const busy = new Set(existing.filter((c) => c.status === 'draft' || c.status === 'approved' || c.status === 'control').map((c) => c.donorId))
      const cutoff = Date.now() - CONTACT_COOLDOWN_DAYS * 86_400_000
      const recent = new Set(existing.filter((c) => c.status === 'sent' && c.sentAt && Date.parse(c.sentAt) > cutoff).map((c) => c.donorId))
      const items: CampaignItem[] = []
      let skipped = 0
      for (const id of ids) {
        const s = scoresById.get(id)
        const d = donorsById.get(id)
        if (!s?.action || !d || !d.emailConsent || busy.has(id)) continue
        if (recent.has(id)) {
          skipped++
          continue
        }
        const { subject, body } = draftEmail(s.action, d, s)
        // tirage stable par donateur, quelle que soit l'origine : 10 % des ciblés forment le groupe témoin (jamais pour un remerciement)
        const control = s.action !== 'thank' && (parseInt(id.replace(/\D/g, ''), 10) * 2654435761) % 100 < CONTROL_SHARE * 100
        items.push({ id: uid(), donorId: id, type: s.action, subject, body, status: control ? 'control' : 'draft', createdAt: new Date().toISOString(), origin })
      }
      return { items, skipped }
    },
    [scoresById, donorsById],
  )

  const store: Store = {
    dataset,
    donorsById,
    reports,
    training,
    trainingStep,
    trainMs,
    trainError,
    trainSkipped,
    scores,
    scoresById,
    automations,
    campaign,
    algoChoice,
    modelVersion,
    modelTrainedAt: trainedAt,
    retrain: () => train(dataset),
    setAlgo: (kind, choice) => setAlgoChoice((a) => ({ ...a, [kind]: choice })),
    loadDataset: (ds) => {
      setDataset(ds)
      setCampaign([])
    },
    setAutomation: (type, patch) => setAutomations((list) => list.map((a) => (a.type === type ? { ...a, ...patch } : a))),
    createDrafts: (ids) => {
      const { items } = makeDrafts(ids, campaign, 'manual')
      setCampaign((c) => [...items, ...c])
      const control = items.filter((i) => i.status === 'control').length
      return { drafted: items.length - control, control }
    },
    updateItem: (id, patch) => setCampaign((c) => c.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    sendItems: (ids) => {
      // Envoi simulé : on marque le courriel comme envoyé (pas de fournisseur branché dans le prototype)
      const eligible = new Set(
        campaign.filter((i) => ids.includes(i.id) && i.status !== 'sent' && donorsById.get(i.donorId)?.emailConsent).map((i) => i.id),
      )
      const now = new Date().toISOString()
      setCampaign((c) => c.map((i) => (eligible.has(i.id) ? { ...i, status: 'sent', sentAt: now } : i)))
      return eligible.size
    },
    runCycle: () => {
      const targets = scores.filter((s) => s.action).map((s) => s.donorId)
      const { items, skipped } = makeDrafts(targets, campaign, 'auto')
      const now = new Date().toISOString()
      let sent = 0
      const control = items.filter((d) => d.status === 'control').length
      const processed = items.map((d) => {
        if (d.status === 'control') return d
        const auto = automations.find((a) => a.type === d.type)
        if (auto && !auto.requireApproval) {
          sent++
          return { ...d, status: 'sent' as const, sentAt: now }
        }
        return d
      })
      setCampaign((c) => [...processed, ...c])
      return { drafted: processed.length - sent - control, sent, skipped, control }
    },
    resetCampaign: () => setCampaign([]),
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors du StoreProvider')
  return s
}
