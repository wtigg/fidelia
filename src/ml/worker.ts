/// <reference lib="webworker" />
import type { Dataset, ModelKind } from '../lib/types.ts'
import { MODEL_KINDS, trainAll, type ModelReport } from './pipeline.ts'

export interface TrainRequest {
  dataset: Dataset
}

export type TrainMessage =
  | { type: 'progress'; kind: ModelKind }
  | { type: 'done'; reports: Partial<Record<ModelKind, ModelReport>>; ms: number; skipped: ModelKind[] }
  | { type: 'error'; message: string }

const post = (m: TrainMessage) => self.postMessage(m)

self.onmessage = (e: MessageEvent<TrainRequest>) => {
  const t0 = performance.now()
  try {
    const reports = trainAll(e.data.dataset, (kind) => post({ type: 'progress', kind }))
    // Modèles non entraînés : pas assez d'exemples ou de cas positifs dans le jeu importé
    const skipped = MODEL_KINDS.filter((k) => !reports[k])
    post({ type: 'done', reports, ms: Math.round(performance.now() - t0), skipped })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
