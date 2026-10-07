// Validation sur données réelles : KDD Cup 1998 (donateurs inactifs d'une organisation nationale de vétérans, États-Unis).
// Prérequis : ./scripts/download-kdd98.sh   Lancement : npm run kdd98
import { readFileSync, writeFileSync } from 'node:fs'
import { runExperiment, splitOf, predictLearned, type Row } from '../src/ml/experiment.ts'
import { rfmScore } from '../src/ml/rfm.ts'

const MAIL = 97 * 12 + 6 // relance de juin 1997
const COST = 0.68 // coût d'un envoi postal dans la compétition ($)
const t0 = performance.now()
const lines = readFileSync(new URL('../data/kdd98/cup98LRN.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean)
const header = lines[0].split(',')
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
const num = (r: string[], k: string) => {
  const v = Number(r[col[k]])
  return Number.isFinite(v) ? v : NaN
}
const months = (yymm: number) => (Number.isFinite(yymm) && yymm > 0 ? Math.floor(yymm / 100) * 12 + (yymm % 100) : NaN)
const REGION: Record<string, string> = {}
for (const s of 'CT ME MA NH RI VT NJ NY PA'.split(' ')) REGION[s] = 'Nord-Est'
for (const s of 'IL IN MI OH WI IA KS MN MO NE ND SD'.split(' ')) REGION[s] = 'Midwest'
for (const s of 'DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX'.split(' ')) REGION[s] = 'Sud'
for (const s of 'AZ CO ID MT NV NM UT WY AK CA HI OR WA'.split(' ')) REGION[s] = 'Ouest'

const FEATURES = [
  'mois_depuis_dernier_don', 'nb_dons_total', 'don_moyen', 'montant_total', 'dernier_don', 'don_max',
  'dernier_vs_moyen', 'anciennete_mois', 'taux_reponse_relances', 'taux_reponse_cartes', 'relances_12_mois',
  'tendance_nb_dons_96_vs_95', 'tendance_montant_96_vs_95', 'delai_premier_second_don', 'code_frequence', 'code_montant',
]

interface Raw { id: string; x: number[]; rfm: Row['rfm']; targetB: number; targetD: number; lastGift: number; ageBand: string; region: string }
const raws: Raw[] = []
for (let k = 1; k < lines.length; k++) {
  const r = lines[k].split(',')
  const lastGift = num(r, 'LASTGIFT')
  const avg = num(r, 'AVGGIFT')
  const nGifts = num(r, 'NGIFTALL')
  const recency = MAIL - months(num(r, 'LASTDATE'))
  const tenure = MAIL - months(num(r, 'FISTDATE'))
  let g96 = 0, g95 = 0, a96 = 0, a95 = 0
  for (let i = 3; i <= 22; i++) {
    const a = num(r, `RAMNT_${i}`)
    if (a > 0) { if (i <= 12) { g96++; a96 += a } else { g95++; a95 += a } }
  }
  const age = num(r, 'AGE')
  raws.push({
    id: r[col.CONTROLN],
    x: [
      recency, Math.log1p(nGifts), Math.log1p(avg), Math.log1p(num(r, 'RAMNTALL')), Math.log1p(lastGift), Math.log1p(num(r, 'MAXRAMNT')),
      Math.log((lastGift + 1) / (avg + 1)), Math.log1p(Math.max(0, tenure)), nGifts / Math.max(1, num(r, 'NUMPROM')),
      num(r, 'CARDGIFT') / Math.max(1, num(r, 'CARDPROM')), num(r, 'NUMPRM12'), g96 - g95, Math.log((a96 + 1) / (a95 + 1)),
      num(r, 'TIMELAG'), num(r, 'RFA_2F'), ' DEFG'.indexOf((r[col.RFA_2A] ?? '').trim()),
    ],
    rfm: { recency, frequency: nGifts, monetary: avg },
    targetB: num(r, 'TARGET_B'),
    targetD: num(r, 'TARGET_D'),
    lastGift,
    ageBand: !Number.isFinite(age) || age <= 0 ? 'Inconnu' : age < 40 ? 'Moins de 40 ans' : age < 60 ? '40 à 59 ans' : age < 75 ? '60 à 74 ans' : '75 ans et plus',
    region: REGION[(r[col.STATE] ?? '').trim()] ?? 'Autre',
  })
}

// Valeurs manquantes : imputation par la médiane (calculée hors test), avec suivi du taux de manquants
const missing = FEATURES.map((_, j) => raws.filter((r) => !Number.isFinite(r.x[j])).length / raws.length)
const medians = FEATURES.map((_, j) => {
  const v = raws.filter((r) => splitOf(r.id) !== 'test' && Number.isFinite(r.x[j])).map((r) => r.x[j]).sort((a, b) => a - b)
  return v[Math.floor(v.length / 2)] ?? 0
})
for (const r of raws) r.x = r.x.map((v, j) => (Number.isFinite(v) ? v : medians[j]))
console.log(`${raws.length} donateurs lus en ${Math.round(performance.now() - t0)} ms ; manquants :`, FEATURES.map((f, j) => (missing[j] > 0 ? `${f}=${(missing[j] * 100).toFixed(1)}%` : '')).filter(Boolean).join(' ') || 'aucun')

const toRows = (y: (r: Raw) => number): Row[] =>
  raws.map((r) => ({ group: r.id, period: 0, x: r.x, y: y(r), rfm: r.rfm, value: r.targetD, ageBand: r.ageBand, region: r.region }))

const tasks = {
  reactivation: { title: 'Réactivation : le donateur inactif répond-il à la relance ?', y: (r: Raw) => (r.targetB === 1 ? 1 : 0) },
  hausse: { title: 'Hausse : donne-t-il plus que son dernier don ?', y: (r: Raw) => (r.targetD > r.lastGift ? 1 : 0) },
}

const out: Record<string, unknown> = { source: 'KDD Cup 1998 (UCI)', n: raws.length, features: FEATURES, missing: Object.fromEntries(FEATURES.map((f, j) => [f, missing[j]])) }
for (const [key, task] of Object.entries(tasks)) {
  const t1 = performance.now()
  const res = runExperiment(toRows(task.y), FEATURES, { rfmSign: 1, epochs: 300, learningCurve: true, bootstrapRounds: 200 })
  if (!res) continue
  console.log(`\n${task.title} (${Math.round(performance.now() - t1)} ms) taux=${(res.baseRate * 100).toFixed(2)}% retenu=${res.selected} L2=${res.hyper.l2} prof=${res.hyper.depth} arbres=${res.hyper.rounds}`)
  for (const e of res.evaluations)
    console.log(`  ${e.algorithm.padEnd(9)} AUC-PR=${e.ap.toFixed(4)} [${e.apCI.map((v) => v.toFixed(4)).join('–')}] AUC=${e.auc.toFixed(3)} [${e.aucCI.map((v) => v.toFixed(3)).join('–')}] P@50=${e.p50.toFixed(2)} lift10=${e.top10.lift.toFixed(2)}`)
  console.log('  importance', res.importance.find((i) => i.algorithm === res.selected || i.algorithm === 'gbdt')!.values.slice(0, 6).map((v) => `${v.feature}:${v.drop.toFixed(3)}`).join(' '))
  console.log('  courbe apprentissage', res.learningCurve?.map((l) => `${l.n}→${l.ap.toFixed(4)}`).join(' '))
  for (const f of res.fairness) console.log(`  équité ${f.by}`, f.groups.map((g) => `${g.group}: n=${g.n} taux=${(g.baseRate * 100).toFixed(1)}% sel=${g.selectionRatio.toFixed(2)}`).join(' | '))

  let profit: unknown
  if (key === 'reactivation') {
    // Impact : profit net de la relance sur le jeu de test selon la stratégie de ciblage
    const test = raws.filter((r) => splitOf(r.id) === 'test')
    const trainResp = raws.filter((r) => splitOf(r.id) !== 'test' && r.targetB === 1)
    const ratio = trainResp.reduce((s, r) => s + r.targetD / Math.max(1, r.lastGift), 0) / trainResp.length
    const p = test.map((r) => predictLearned(res, res.selected, r.x))
    const expected = test.map((r, i) => p[i] * ratio * r.lastGift)
    const net = (sel: boolean[]) => test.reduce((s, r, i) => s + (sel[i] ? r.targetD - COST : 0), 0)
    const topK = (score: number[], k: number) => {
      const cut = [...score].sort((a, b) => b - a)[k - 1]
      return score.map((v) => v >= cut)
    }
    const rfm = test.map((r) => rfmScore(res.rfm, r.rfm))
    const all = net(test.map(() => true))
    const ev = expected.map((e) => e > COST)
    const nEv = ev.filter(Boolean).length
    profit = {
      cost: COST,
      nTest: test.length,
      everyone: { mailed: test.length, net: all },
      modelExpectedValue: { mailed: nEv, net: net(ev) },
      rfmSameVolume: { mailed: nEv, net: net(topK(rfm, nEv)) },
      modelTop20: { mailed: Math.round(test.length * 0.2), net: net(topK(expected, Math.round(test.length * 0.2))) },
      rfmTop20: { mailed: Math.round(test.length * 0.2), net: net(topK(rfm, Math.round(test.length * 0.2))) },
      donationsCaptured: { model: test.reduce((s, r, i) => s + (ev[i] ? r.targetD : 0), 0), total: test.reduce((s, r) => s + r.targetD, 0) },
    }
    console.log('  profit', JSON.stringify(profit))
  }
  const { logistic, gbdt, ...light } = res
  out[key] = { title: task.title, ...light, profit, model: { logistic, gbdtTrees: gbdt.trees.length } }
}
writeFileSync(new URL('../reports/kdd98.json', import.meta.url), JSON.stringify(out, null, 1))
console.log(`\nRapport écrit dans reports/kdd98.json (${Math.round((performance.now() - t0) / 1000)} s)`)
