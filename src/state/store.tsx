import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { generateDemo } from '../data/generate.ts'
import { draftEmail } from '../lib/emails.ts'
import type { ActionType, Automation, CampaignItem, Dataset, Donor, DonorScore, ModelKind } from '../lib/types.ts'
import { DEFAULT_AUTOMATIONS, scoreAll, type ModelReport, type TrainOptions, type TrainedModel } from '../ml/pipeline.ts'
import type { TrainRequest } from '../ml/worker.ts'

type Reports = Partial<Record<ModelKind, ModelReport>>
export type AlgoChoice = 'auto' | TrainedModel['algorithm']

interface Store {
  dataset: Dataset
  donorsById: Map<string, Donor>
  reports: Reports
  training: boolean
  trainMs?: number
  trainOptions: TrainOptions
  scores: DonorScore[]
  scoresById: Map<string, DonorScore>
  automations: Automation[]
  campaign: CampaignItem[]
  algoChoice: Record<ModelKind, AlgoChoice>
  retrain: (opts?: TrainOptions) => void
  setAlgo: (kind: ModelKind, choice: AlgoChoice) => void
  loadDataset: (ds: Dataset) => void
  setAutomation: (type: ActionType, patch: Partial<Automation>) => void
  createDrafts: (donorIds: string[]) => number
  updateItem: (id: string, patch: Partial<CampaignItem>) => void
  sendItems: (ids: string[]) => number
  runCycle: () => { drafted: number; sent: number }
  resetCampaign: () => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`fidelia:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`fidelia:${key}`, JSON.stringify(value))
  } catch {
    // stockage indisponible : l'état reste en mémoire
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(() => generateDemo())
  const [rawReports, setRawReports] = useState<Reports>({})
  const [training, setTraining] = useState(true)
  const [trainMs, setTrainMs] = useState<number>()
  const [trainOptions, setTrainOptions] = useState<TrainOptions>({})
  const [automations, setAutomations] = useState<Automation[]>(() => load('automations', DEFAULT_AUTOMATIONS))
  const [campaign, setCampaign] = useState<CampaignItem[]>(() => load('campaign', []))
  const [algoChoice, setAlgoChoice] = useState<Record<ModelKind, AlgoChoice>>(() =>
    load('algo', { churn: 'auto', conversion: 'auto', reactivation: 'auto' }),
  )
  const worker = useRef<Worker | null>(null)

  useEffect(() => save('automations', automations), [automations])
  useEffect(() => save('campaign', campaign), [campaign])
  useEffect(() => save('algo', algoChoice), [algoChoice])

  // Un worker par entraînement : le calcul ne bloque pas l'interface
  const train = useCallback((ds: Dataset, options: TrainOptions) => {
    worker.current?.terminate()
    const w = new Worker(new URL('../ml/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<{ reports: Reports; ms: number }>) => {
      setRawReports(e.data.reports)
      setTrainMs(e.data.ms)
      setTraining(false)
      w.terminate()
    }
    setTraining(true)
    const msg: TrainRequest = { id: 0, dataset: ds, options }
    w.postMessage(msg)
  }, [])

  useEffect(() => {
    train(dataset, trainOptions)
    return () => worker.current?.terminate()
  }, [dataset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Le choix d'algorithme s'applique sans réentraîner : les deux modèles sont déjà entraînés
  const reports = useMemo(() => {
    const out: Reports = {}
    for (const [k, r] of Object.entries(rawReports) as [ModelKind, ModelReport][]) {
      const c = algoChoice[k]
      const best = r.evaluations[0].auc >= r.evaluations[1].auc ? 'logistic' : 'gbdt'
      out[k] = { ...r, selected: c === 'auto' ? best : c }
    }
    return out
  }, [rawReports, algoChoice])

  const scores = useMemo(() => (Object.keys(reports).length ? scoreAll(dataset, reports, automations) : []), [dataset, reports, automations])
  const scoresById = useMemo(() => new Map(scores.map((s) => [s.donorId, s])), [scores])
  const donorsById = useMemo(() => new Map(dataset.donors.map((d) => [d.id, d])), [dataset])

  const makeDrafts = useCallback(
    (ids: string[], existing: CampaignItem[], origin: CampaignItem['origin']): CampaignItem[] => {
      const open = new Set(existing.filter((c) => c.status !== 'dismissed' && c.status !== 'sent').map((c) => c.donorId))
      const out: CampaignItem[] = []
      for (const id of ids) {
        const s = scoresById.get(id)
        const d = donorsById.get(id)
        if (!s?.action || !d || !d.emailConsent || open.has(id)) continue
        const { subject, body } = draftEmail(s.action, d, s)
        out.push({ id: uid(), donorId: id, type: s.action, subject, body, status: 'draft', createdAt: new Date().toISOString(), origin })
      }
      return out
    },
    [scoresById, donorsById],
  )

  const store: Store = {
    dataset,
    donorsById,
    reports,
    training,
    trainMs,
    trainOptions,
    scores,
    scoresById,
    automations,
    campaign,
    algoChoice,
    retrain: (opts) => {
      const o = opts ?? trainOptions
      setTrainOptions(o)
      train(dataset, o)
    },
    setAlgo: (kind, choice) => setAlgoChoice((a) => ({ ...a, [kind]: choice })),
    loadDataset: (ds) => {
      setDataset(ds)
      setCampaign([])
    },
    setAutomation: (type, patch) => setAutomations((list) => list.map((a) => (a.type === type ? { ...a, ...patch } : a))),
    createDrafts: (ids) => {
      const drafts = makeDrafts(ids, campaign, 'manual')
      setCampaign((c) => [...drafts, ...c])
      return drafts.length
    },
    updateItem: (id, patch) => setCampaign((c) => c.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    sendItems: (ids) => {
      // Envoi simulé : on marque l'email comme envoyé (pas de fournisseur email branché)
      const eligible = new Set(
        campaign
          .filter((i) => ids.includes(i.id) && i.status !== 'sent' && donorsById.get(i.donorId)?.emailConsent)
          .map((i) => i.id),
      )
      const now = new Date().toISOString()
      setCampaign((c) => c.map((i) => (eligible.has(i.id) ? { ...i, status: 'sent', sentAt: now } : i)))
      return eligible.size
    },
    runCycle: () => {
      const targets = scores.filter((s) => s.action).map((s) => s.donorId)
      const drafts = makeDrafts(targets, campaign, 'auto')
      const now = new Date().toISOString()
      let sent = 0
      const processed = drafts.map((d) => {
        const auto = automations.find((a) => a.type === d.type)
        if (auto && !auto.requireApproval && donorsById.get(d.donorId)?.emailConsent) {
          sent++
          return { ...d, status: 'sent' as const, sentAt: now }
        }
        return d
      })
      setCampaign((c) => [...processed, ...c])
      return { drafted: processed.length - sent, sent }
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
