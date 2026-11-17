// Chiffres d'impact et intervalles de confiance des ratios d'équité par âge.
// Lancement autonome : npm run impact [graine] [fichier de sortie]  (défaut : reports/impact-<graine>.json)
// Aussi appelé par scripts/evaluate.ts, qui écrit impact-<graine>.json à côté de son rapport (vérifié par npm run check:repro).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateDemo } from '../src/data/generate.ts'
import { DEFAULT_EFFECT, simulate } from '../src/lib/impact.ts'
import { rng } from '../src/lib/random.ts'
import type { Dataset, ModelKind } from '../src/lib/types.ts'
import { fairnessBy, predictLearned, splitOf, type Row } from '../src/ml/experiment.ts'
import { MODEL_KINDS, buildRows, scoreAll, trainModel, type ModelReport } from '../src/ml/pipeline.ts'

export const CAPACITIES = [100, 300] as const
export const BOOTSTRAP_ROUNDS = 1000
export const BOOTSTRAP_SEED = 42

type Reports = Partial<Record<ModelKind, ModelReport>>
const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 1e4) / 1e4
const ratio = (a: number, b: number) => (b > 0 ? r4(a / b) : null)

/** Valeur captée (en $ par an) à capacité fixe : modèle déployé, règle RFM, hasard, et multiplicateurs */
function impactAt(scores: ReturnType<typeof scoreAll>, reports: Reports, capacity: number) {
  const lines = simulate(scores, reports, capacity, DEFAULT_EFFECT)
  const sum = (key: 'model' | 'rfm' | 'random') => lines.reduce((s, l) => s + l[key], 0)
  const total = { model: sum('model'), rfm: sum('rfm'), random: sum('random') }
  return {
    capacity,
    byModel: lines.map((l) => ({
      kind: l.kind,
      deployed: reports[l.kind]!.deployed,
      population: l.population,
      contacted: l.contacted,
      atStake: r2(l.atStake),
      model: r2(l.model),
      rfm: r2(l.rfm),
      random: r2(l.random),
      multiplierVsRfm: ratio(l.model, l.rfm),
      multiplierVsRandom: ratio(l.model, l.random),
    })),
    total: {
      contacted: lines.reduce((s, l) => s + l.contacted, 0),
      model: r2(total.model),
      rfm: r2(total.rfm),
      random: r2(total.random),
      multiplierVsRfm: ratio(total.model, total.rfm),
      multiplierVsRandom: ratio(total.model, total.random),
    },
  }
}

/**
 * IC à 95 % des ratios de sélection par tranche d'âge (part du groupe dans le top 20 % / part dans la population).
 * Bootstrap par donateur (un donateur peut avoir plusieurs photos dans le jeu de test), percentiles 2,5 et 97,5.
 * Les prédictions sont celles de l'algorithme retenu sur la validation, comme dans le rapport (fairness).
 */
function fairnessCI(ds: Dataset, kind: ModelKind, r: ModelReport) {
  const test = buildRows(ds, kind).filter((row) => splitOf(row.group) === 'test')
  const p = test.map((row) => predictLearned(r, r.selected, row.x))
  const point = fairnessBy('age', test, p)
  const byDonor = new Map<string, number[]>()
  test.forEach((row, i) => byDonor.set(row.group, [...(byDonor.get(row.group) ?? []), i]))
  const donors = [...byDonor.values()]
  const rand = rng(BOOTSTRAP_SEED)
  const samples = new Map<string, number[]>(point.map((g) => [g.group, []]))
  for (let b = 0; b < BOOTSTRAP_ROUNDS; b++) {
    const rows: Row[] = []
    const ps: number[] = []
    for (let k = 0; k < donors.length; k++) {
      for (const i of donors[Math.floor(rand.next() * donors.length)]) {
        rows.push(test[i])
        ps.push(p[i])
      }
    }
    for (const g of fairnessBy('age', rows, ps)) samples.get(g.group)?.push(g.selectionRatio)
  }
  const pct = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.max(0, Math.floor(q * xs.length)))]
  return {
    kind,
    algorithm: r.selected,
    nTest: test.length,
    donorsTest: donors.length,
    groups: point.map((g) => {
      const xs = samples.get(g.group)!.sort((a, b) => a - b)
      return {
        group: g.group,
        n: g.n,
        selectionRatio: r4(g.selectionRatio),
        ci95: [r4(pct(xs, 0.025)), r4(pct(xs, 0.975))] as [number, number],
        // 1 dans l'intervalle : écart à la proportionnalité non significatif au seuil de 5 %
        includesOne: pct(xs, 0.025) <= 1 && pct(xs, 0.975) >= 1,
        rounds: xs.length,
      }
    }),
  }
}

/**
 * Mêmes chiffres avec le modèle versionné src/data/model.json, tel que l'application l'affiche (tableau de bord, page Impact).
 * Depuis la v20261110.0120, scripts/train.ts garde les paramètres de prédiction en pleine précision :
 * ces chiffres doivent être identiques à ceux du réentraînement (bloc « impact »).
 */
function bundledImpact(ds: Dataset, seed: number) {
  const bundled = JSON.parse(readFileSync(new URL('../src/data/model.json', import.meta.url), 'utf8')) as {
    version: string
    dataset: { source: string; donors: number; seed: number }
    reports: Reports
  }
  if (bundled.dataset.seed !== seed || bundled.dataset.donors !== ds.donors.length) return undefined
  const scores = scoreAll(ds, bundled.reports)
  return {
    version: bundled.version,
    note: 'Chiffres affichés par l\'application (modèle versionné, paramètres de prédiction en pleine précision). Ils doivent être identiques à ceux de « impact ».',
    impact: CAPACITIES.map((c) => impactAt(scores, bundled.reports, c)),
  }
}

export function impactReport(ds: Dataset, reports: Reports, seed: number) {
  const scores = scoreAll(ds, reports)
  return {
    seed,
    donors: ds.donors.length,
    refDate: ds.refDate,
    note: "Valeur captée en $ par an, à effort égal (même nombre de contacts). Part captée lue sur la courbe de valeur mesurée sur le jeu de test ; effet de l'action = hypothèse (effectAssumed), identique pour les trois stratégies, donc sans effet sur les multiplicateurs.",
    effectAssumed: DEFAULT_EFFECT,
    impact: CAPACITIES.map((c) => impactAt(scores, reports, c)),
    app: bundledImpact(ds, seed),
    fairnessAge: {
      method: `bootstrap par donateur, ${BOOTSTRAP_ROUNDS} tirages, graine ${BOOTSTRAP_SEED}, percentiles 2,5 et 97,5`,
      models: MODEL_KINDS.filter((k) => reports[k]).map((k) => fairnessCI(ds, k, reports[k]!)),
    },
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const seed = Number(process.argv[2] ?? 42)
  const ds = generateDemo(4000, seed)
  const reports: Reports = {}
  for (const k of MODEL_KINDS) {
    const r = trainModel(ds, k)
    if (r) reports[k] = r
  }
  const out = process.argv[3] ?? fileURLToPath(new URL(`../reports/impact-${seed}.json`, import.meta.url))
  writeFileSync(out, JSON.stringify(impactReport(ds, reports, seed), null, 1))
  console.log(`impact écrit dans ${out}`)
}
