import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { generateDemo } from '../data/generate.ts'
import { draftEmail } from '../lib/emails.ts'
import type { ActionType, Automation, CampaignItem, Dataset, Donor, DonorScore, ModelKind } from '../lib/types.ts'
import { DEFAULT_AUTOMATIONS, scoreAll, type Algorithm, type ModelReport } from '../ml/pipeline.ts'
import type { TrainRequest } from '../ml/worker.ts'
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
  scores: DonorScore[]
  scoresById: Map<string, DonorScore>
  automations: Automation[]
  campaign: CampaignItem[]
  algoChoice: Record<ModelKind, AlgoChoice>
  modelVersion: string
  retrain: () => void
  setAlgo: (kind: ModelKind, choice: AlgoChoice) => void
  loadDataset: (ds: Dataset) => void
  setAutomation: (type: ActionType, patch: Partial<Automation>) => void
  createDrafts: (donorIds: string[]) => number
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
  const [trainingStep, setTrainingStep] = useState<ModelKind>()
  const [trainMs, setTrainMs] = useState<number>()
  const [automations, setAutomations] = useState<Automation[]>(() => {
    const saved = load<Automation[]>('automations', DEFAULT_AUTOMATIONS)
    return DEFAULT_AUTOMATIONS.map((d) => saved.find((s) => s.type === d.type) ?? d)
  })
  const [campaign, setCampaign] = useState<CampaignItem[]>(() => load('campaign', []))
  const [algoChoice, setAlgoChoice] = useState<Record<ModelKind, AlgoChoice>>(() =>
    load('algo', { churn: 'auto', upgrade: 'auto', conversion: 'auto', reactivation: 'auto' }),
  )
  const worker = useRef<Worker | null>(null)

  useEffect(() => save('automations', automations), [automations])
  useEffect(() => save('campaign', campaign), [campaign])
  useEffect(() => save('algo', algoChoice), [algoChoice])

  // Un worker par entraînement : le calcul ne bloque pas l'interface
  const train = useCallback((ds: Dataset) => {
    worker.current?.terminate()
    const w = new Worker(new URL('../ml/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<{ type: 'progress'; kind: ModelKind } | { type: 'done'; reports: Reports; ms: number }>) => {
      if (e.data.type === 'progress') {
        setTrainingStep(e.data.kind)
        return
      }
      setRawReports(e.data.reports)
      setTrainMs(e.data.ms)
      const t = new Date().toISOString()
      setVersion(`v${t.slice(0, 10).replace(/-/g, '')}.${t.slice(11, 16).replace(':', '')}-local`)
      setTraining(false)
      setTrainingStep(undefined)
      w.terminate()
    }
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
      const busy = new Set(existing.filter((c) => c.status === 'draft' || c.status === 'approved').map((c) => c.donorId))
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
        items.push({ id: uid(), donorId: id, type: s.action, subject, body, status: 'draft', createdAt: new Date().toISOString(), origin })
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
    scores,
    scoresById,
    automations,
    campaign,
    algoChoice,
    modelVersion,
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
      return items.length
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
      let control = 0
      const processed = items.map((d) => {
        const auto = automations.find((a) => a.type === d.type)
        // tirage stable par donateur : 10 % des ciblés forment le groupe témoin (jamais pour un remerciement)
        if (d.type !== 'thank' && (parseInt(d.donorId.replace(/\D/g, ''), 10) * 2654435761) % 100 < CONTROL_SHARE * 100) {
          control++
          return { ...d, status: 'control' as const }
        }
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
