// Robustesse : le modèle bat-il la règle RFM quel que soit le jeu synthétique généré ? npm run robustness
// On fait varier la graine du générateur (donc les donateurs, leurs comportements et le bruit).
import { writeFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { MODEL_KINDS, trainModel } from '../src/ml/pipeline.ts'

const seeds = [1, 2, 3, 4, 5]
const rows: Record<string, { model: number[]; rfm: number[]; auc: number[]; aucRfm: number[]; deployed: number }> = {}
for (const seed of seeds) {
  const ds = generateDemo(4000, seed)
  for (const k of MODEL_KINDS) {
    const r = trainModel(ds, k)
    if (!r) continue
    const sel = r.evaluations.find((e) => e.algorithm === r.selected)!
    const rfm = r.evaluations.find((e) => e.algorithm === 'rfm')!
    rows[k] ??= { model: [], rfm: [], auc: [], aucRfm: [], deployed: 0 }
    if (r.deployed !== 'rfm') rows[k].deployed++
    rows[k].model.push(sel.ap); rows[k].rfm.push(rfm.ap); rows[k].auc.push(sel.auc); rows[k].aucRfm.push(rfm.auc)
  }
  process.stdout.write(`graine ${seed} ok\n`)
}
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const sd = (v: number[]) => Math.sqrt(mean(v.map((x) => (x - mean(v)) ** 2)))
const out = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, {
  apModel: [mean(v.model), sd(v.model)], apRfm: [mean(v.rfm), sd(v.rfm)], aucModel: [mean(v.auc), sd(v.auc)], aucRfm: [mean(v.aucRfm), sd(v.aucRfm)],
  wins: v.model.filter((m, i) => m > v.rfm[i]).length, deployed: v.deployed, runs: v.model.length,
}]))
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(13)} AUC-PR modèle ${v.apModel[0].toFixed(3)} ± ${v.apModel[1].toFixed(3)} | RFM ${v.apRfm[0].toFixed(3)} ± ${v.apRfm[1].toFixed(3)} | modèle gagne ${v.wins}/${v.runs} | déployé (R1+R2) ${v.deployed}/${v.runs}`)
writeFileSync(new URL('../reports/robustesse.json', import.meta.url), JSON.stringify({ seeds, results: out }, null, 1))
