// Évalue les modèles sur les données de démo : npx tsx scripts/evaluate.ts
import { generateDemo } from '../src/data/generate.ts'
import { MODEL_KINDS, scoreAll, trainModel, type ModelReport } from '../src/ml/pipeline.ts'
import type { ModelKind } from '../src/lib/types.ts'

const ds = generateDemo()
console.log(`donateurs=${ds.donors.length} dons=${ds.donations.length}`)
const reports: Partial<Record<ModelKind, ModelReport>> = {}
for (const k of MODEL_KINDS) {
  const t0 = performance.now()
  const r = trainModel(ds, k)
  if (!r) { console.log(k, 'pas assez de données'); continue }
  reports[k] = r
  console.log(`${k} n=${r.nTrain}/${r.nTest} taux=${(r.baseRate * 100).toFixed(1)}% retenu=${r.selected} ${Math.round(performance.now() - t0)}ms`)
  for (const e of r.evaluations)
    console.log(`   ${e.algorithm.padEnd(9)} AUC=${e.auc.toFixed(3)} lift@10%=${e.top10.lift.toFixed(2)} ${e.importance?.slice(0, 4).map((i) => `${i.feature}:${i.value.toFixed(2)}`).join(' ') ?? ''}`)
}
const scores = scoreAll(ds, reports)
const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {})
console.log('segments', count(scores, (s) => s.segment))
console.log('actions', count(scores.filter((s) => s.action), (s) => s.action!))
console.log(JSON.stringify(scores.slice(0, 3).map((s) => ({ id: s.donorId, seg: s.segment, p: s.actionProb.toFixed(2), ev: s.expectedValue, r: s.reasons.map((x) => x.text) })), null, 1))
