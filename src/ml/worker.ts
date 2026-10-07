/// <reference lib="webworker" />
import type { Dataset } from '../lib/types.ts'
import { trainAll } from './pipeline.ts'

export interface TrainRequest {
  dataset: Dataset
}

self.onmessage = (e: MessageEvent<TrainRequest>) => {
  const t0 = performance.now()
  const reports = trainAll(e.data.dataset, (kind) => self.postMessage({ type: 'progress', kind }))
  self.postMessage({ type: 'done', reports, ms: Math.round(performance.now() - t0) })
}
