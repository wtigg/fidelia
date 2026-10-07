// Évalue les modèles sur les données synthétiques : npm run evaluate
import { writeFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { MODEL_KINDS, scoreAll, trainModel, type ModelReport } from '../src/ml/pipeline.ts'
import type { ModelKind } from '../src/lib/types.ts'

const seed = Number(process.argv[2] ?? 42)
const ds = generateDemo(4000, seed)
console.log(`graine=${seed} donateurs=${ds.donors.length} dons=${ds.donations.length}`)
const reports: Partial<Record<ModelKind, ModelReport>> = {}
for (const k of MODEL_KINDS) {
  const r = trainModel(ds, k, { learningCurve: true })
  if (!r) { console.log(k, 'pas assez de données'); continue }
  reports[k] = r
  console.log(`\n${k} n=${r.nTrain}/${r.nVal}/${r.nTest} taux=${(r.baseRate * 100).toFixed(1)}% retenu=${r.selected} L2=${r.hyper.l2} prof=${r.hyper.depth} arbres=${r.hyper.rounds} ${r.ms}ms`)
  for (const e of r.evaluations)
    console.log(`  ${e.algorithm.padEnd(9)} AUC-PR=${e.ap.toFixed(3)} [${e.apCI.map((v) => v.toFixed(3)).join('–')}] AUC=${e.auc.toFixed(3)} P@50=${e.p50.toFixed(2)} lift10=${e.top10.lift.toFixed(2)}${e.brier !== undefined ? ` brier=${e.brier.toFixed(4)}` : ''}`)
  if (r.temporal) console.log(`  temporel AUC-PR=${r.temporal.ap.toFixed(3)} AUC=${r.temporal.auc.toFixed(3)} n=${r.temporal.nTest}`)
  console.log('  importance', r.importance.find((i) => i.algorithm === (r.selected === 'ensemble' ? 'gbdt' : r.selected))!.values.slice(0, 5).map((v) => `${v.feature}:${v.drop.toFixed(3)}`).join(' '))
  console.log('  apprentissage', r.learningCurve?.map((l) => `${l.n}→${l.ap.toFixed(3)}`).join(' '))
  for (const f of r.fairness) console.log(`  équité ${f.by}`, f.groups.map((g) => `${g.group}: n=${g.n} sel=${g.selectionRatio.toFixed(2)}`).join(' | '))
}
const scores = scoreAll(ds, reports)
const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {})
console.log('\nsegments', count(scores, (s) => s.segment))
console.log('actions', count(scores.filter((s) => s.action), (s) => s.action!))
const light = Object.fromEntries(Object.entries(reports).map(([k, r]) => { const { logistic, gbdt, ...rest } = r!; return [k, { ...rest, logistic, gbdtTrees: gbdt.trees.length }] }))
writeFileSync(new URL(`../reports/synthetique-${seed}.json`, import.meta.url), JSON.stringify(light, null, 1))
