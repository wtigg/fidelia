/// <reference lib="webworker" />
import type { Dataset } from '../lib/types.ts'
import { trainAll, type TrainOptions } from './pipeline.ts'

export interface TrainRequest {
  id: number
  dataset: Dataset
  options?: TrainOptions
}

self.onmessage = (e: MessageEvent<TrainRequest>) => {
  const t0 = performance.now()
  const reports = trainAll(e.data.dataset, e.data.options)
  self.postMessage({ id: e.data.id, reports, ms: Math.round(performance.now() - t0) })
}
