// Exporte les exemples d'apprentissage (mêmes variables, mêmes découpages) pour la vérification scikit-learn
import { writeFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { splitOf } from '../src/ml/experiment.ts'
import { FEATURE_KEYS } from '../src/ml/features.ts'
import { MODEL_KINDS, buildRows, trainModel } from '../src/ml/pipeline.ts'

const ds = generateDemo()
const summary: Record<string, unknown> = {}
for (const k of MODEL_KINDS) {
  const rows = buildRows(ds, k)
  const csv = [['split', 'y', ...FEATURE_KEYS].join(','), ...rows.map((r) => [splitOf(r.group), r.y, ...r.x.map((v) => +v.toFixed(6))].join(','))].join('\n')
  writeFileSync(new URL(`../verification/rows-${k}.csv`, import.meta.url), csv)
  const r = trainModel(ds, k)!
  summary[k] = Object.fromEntries(r.evaluations.map((e) => [e.algorithm, { ap: e.ap, auc: e.auc }]))
  console.log(k, rows.length, 'lignes')
}
writeFileSync(new URL('../verification/fidelia-results.json', import.meta.url), JSON.stringify(summary, null, 1))
