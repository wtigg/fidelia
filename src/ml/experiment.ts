import { predictGbdt, trainGbdt, type GbdtModel } from './gbdt.ts'
import { predict as predictLogistic, train as trainLogistic, type LogisticModel } from './logistic.ts'
import {
  auc, averagePrecision, bootstrapCI, bootstrapDiffCI, brier, calibration, gainCurve, logLoss, prCurve, precisionAtK, rocCurve, topFraction,
} from './metrics.ts'
import { fitRfm, rfmScore, type RfmRule } from './rfm.ts'

/**
 * Protocole d'expérience commun aux données synthétiques et à KDD Cup 1998 :
 * 1. découpage par donateur : 60 % entraînement, 20 % validation, 20 % test (un donateur n'est que dans un seul jeu) ;
 * 2. hyperparamètres choisis sur la validation (régularisation, profondeur, nombre d'arbres par arrêt précoce) ;
 * 3. choix de l'algorithme sur la validation (AUC-PR), jamais sur le test ;
 * 4. réentraînement sur entraînement + validation, puis mesure unique sur le test, avec IC à 95 % par bootstrap ;
 * 5. comparaison à la règle RFM, importance par permutation, équité par sous-groupe, test temporel.
 */
export type Algorithm = 'logistic' | 'gbdt' | 'ensemble' | 'rfm'
export type Learned = Exclude<Algorithm, 'rfm'>

export interface Row {
  group: string
  /** Index temporel de la photo (plus grand = plus récent) */
  period: number
  x: number[]
  y: number
  rfm: { recency: number; frequency: number; monetary: number }
  /** Valeur en $ si le cas positif se réalise (impact) */
  value?: number
  ageBand?: string
  region?: string
}

export interface Metrics {
  auc: number
  aucCI: [number, number]
  ap: number
  apCI: [number, number]
  p50: number
  top10: { precision: number; lift: number; recall: number }
  brier?: number
  logLoss?: number
}

export interface Evaluation extends Metrics {
  algorithm: Algorithm
  roc: { x: number; y: number }[]
  pr: { x: number; y: number }[]
  gain: { x: number; y: number }[]
  calibration?: { predicted: number; observed: number; n: number }[]
  /** Part de la valeur ($) captée en contactant x % des donateurs */
  valueGain?: { x: number; y: number }[]
  /** IC 95 % de l'écart d'AUC-PR avec la règle RFM (bootstrap apparié) ; > 0 = meilleur que RFM */
  apDiffVsRfmCI?: [number, number]
}

export interface GroupStat {
  group: string
  n: number
  baseRate: number
  meanPred: number
  auc: number | null
  /** Part du groupe dans le top 20 % / part du groupe dans la population (1 = proportionnel) */
  selectionRatio: number
  precisionTop20: number | null
}

export interface ExperimentResult {
  featureNames: string[]
  nTrain: number
  nVal: number
  nTest: number
  positivesTrain: number
  baseRate: number
  selected: Learned
  hyper: {
    l2: number
    depth: number
    rounds: number
    validation: { algorithm: Learned; setting: string; ap: number }[]
  }
  evaluations: Evaluation[]
  importance: { algorithm: Learned; values: { feature: string; drop: number }[] }[]
  fairness: { by: 'age' | 'region'; groups: GroupStat[] }[]
  temporal?: { trainPeriods: number; testPeriods: number; nTest: number; auc: number; ap: number; p50: number }
  learningCurve?: { fraction: number; n: number; ap: number; auc: number }[]
  logistic: LogisticModel
  gbdt: GbdtModel
  rfm: RfmRule
  rfmSign: 1 | -1
  /** Règle RFM calibrée en probabilité (régression logistique à une variable sur le score RFM) */
  rfmModel: LogisticModel
  means: number[]
}

export interface ExperimentOptions {
  /** +1 si un bon score RFM signifie « positif » (conversion, réactivation), -1 sinon (churn) */
  rfmSign: 1 | -1
  epochs?: number
  learningCurve?: boolean
  bootstrapRounds?: number
  l2Grid?: number[]
  depthGrid?: number[]
}

function hashGroup(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return h % 5
}

export function splitOf(group: string): 'train' | 'val' | 'test' {
  const h = hashGroup(group)
  return h === 0 ? 'test' : h === 1 ? 'val' : 'train'
}

export function predictLearned(r: Pick<ExperimentResult, 'logistic' | 'gbdt'>, algo: Learned, x: number[]): number {
  if (algo === 'logistic') return predictLogistic(r.logistic, x)
  if (algo === 'gbdt') return predictGbdt(r.gbdt, x)
  return (predictLogistic(r.logistic, x) + predictGbdt(r.gbdt, x)) / 2
}

function metricsOf(s: number[], y: number[], probabilities: boolean, rounds: number): Metrics {
  return {
    auc: auc(s, y),
    aucCI: bootstrapCI(auc, s, y, rounds),
    ap: averagePrecision(s, y),
    apCI: bootstrapCI(averagePrecision, s, y, rounds),
    p50: precisionAtK(s, y, 50),
    top10: topFraction(s, y, 0.1),
    brier: probabilities ? brier(s, y) : undefined,
    logLoss: probabilities ? logLoss(s, y) : undefined,
  }
}

function valueGain(s: number[], rows: Row[]): { x: number; y: number }[] | undefined {
  if (!rows.some((r) => r.value)) return undefined
  const order = s.map((v, i) => [v, rows[i].y ? (rows[i].value ?? 0) : 0] as const).sort((a, b) => b[0] - a[0])
  const total = order.reduce((acc, [, v]) => acc + v, 0) || 1
  const out = [{ x: 0, y: 0 }]
  let cum = 0
  let next = 1
  order.forEach(([, v], k) => {
    cum += v
    if ((k + 1) / order.length >= next / 20) { out.push({ x: (k + 1) / order.length, y: cum / total }); next++ }
  })
  return out
}

function fairnessBy(by: 'age' | 'region', rows: Row[], p: number[]): GroupStat[] {
  const key = (r: Row) => (by === 'age' ? r.ageBand : r.region)
  if (!rows.some(key)) return []
  const cutoff = [...p].sort((a, b) => b - a)[Math.floor(p.length * 0.2)] ?? 1
  const groups = [...new Set(rows.map((r) => key(r) ?? 'Inconnu'))].sort()
  return groups.map((g) => {
    const idx = rows.map((r, i) => ((key(r) ?? 'Inconnu') === g ? i : -1)).filter((i) => i >= 0)
    const ys = idx.map((i) => rows[i].y)
    const ps = idx.map((i) => p[i])
    const top = idx.filter((i) => p[i] > cutoff)
    const allTop = p.filter((v) => v > cutoff).length || 1
    const hasBoth = ys.some((v) => v) && ys.some((v) => !v)
    return {
      group: g,
      n: idx.length,
      baseRate: ys.reduce((a, b) => a + b, 0) / idx.length,
      meanPred: ps.reduce((a, b) => a + b, 0) / idx.length,
      auc: hasBoth && idx.length >= 30 ? auc(ps, ys) : null,
      selectionRatio: top.length / allTop / (idx.length / rows.length),
      precisionTop20: top.length >= 10 ? top.filter((i) => rows[i].y).length / top.length : null,
    }
  })
}

export function runExperiment(rows: Row[], featureNames: string[], opts: ExperimentOptions): ExperimentResult | null {
  const { epochs = 500, bootstrapRounds = 200, l2Grid = [0.0003, 0.003, 0.03], depthGrid = [2, 3, 4] } = opts
  const train = rows.filter((r) => splitOf(r.group) === 'train')
  const val = rows.filter((r) => splitOf(r.group) === 'val')
  const test = rows.filter((r) => splitOf(r.group) === 'test')
  const pos = (rs: Row[]) => rs.filter((r) => r.y).length
  if (train.length < 100 || pos(train) < 10 || pos(val) < 3 || pos(test) < 3) return null

  const X = (rs: Row[]) => rs.map((r) => r.x)
  const Y = (rs: Row[]) => rs.map((r) => r.y)
  const yVal = Y(val)
  const validation: ExperimentResult['hyper']['validation'] = []

  // 1. Régression logistique : force de régularisation
  let bestLog = { ap: -1, l2: l2Grid[0], model: null as LogisticModel | null }
  for (const l2 of l2Grid) {
    const m = trainLogistic(X(train), Y(train), { epochs, l2 })
    const ap = averagePrecision(val.map((r) => predictLogistic(m, r.x)), yVal)
    validation.push({ algorithm: 'logistic', setting: `L2 = ${l2}`, ap })
    if (ap > bestLog.ap) bestLog = { ap, l2, model: m }
  }

  // 2. Boosting : profondeur, nombre d'arbres par arrêt précoce sur la validation
  let bestGb = { ap: -1, depth: depthGrid[0], rounds: 1, model: null as GbdtModel | null }
  for (const depth of depthGrid) {
    const m = trainGbdt(X(train), Y(train), { depth, rounds: 400, valX: X(val), valY: yVal })
    const ap = averagePrecision(val.map((r) => predictGbdt(m, r.x)), yVal)
    validation.push({ algorithm: 'gbdt', setting: `profondeur ${depth}, ${m.bestRound} arbres`, ap })
    if (ap > bestGb.ap) bestGb = { ap, depth, rounds: Math.max(1, m.bestRound), model: m }
  }

  // 3. Ensemble (moyenne des deux probabilités)
  const ensAp = averagePrecision(val.map((r) => (predictLogistic(bestLog.model!, r.x) + predictGbdt(bestGb.model!, r.x)) / 2), yVal)
  validation.push({ algorithm: 'ensemble', setting: 'moyenne logistique + boosting', ap: ensAp })
  const candidates: [Learned, number][] = [['logistic', bestLog.ap], ['gbdt', bestGb.ap], ['ensemble', ensAp]]
  const selected = candidates.sort((a, b) => b[1] - a[1])[0][0]

  // 4. Réentraînement sur entraînement + validation avec les réglages retenus
  const full = [...train, ...val]
  const logistic = trainLogistic(X(full), Y(full), { epochs, l2: bestLog.l2 })
  const gbdtFull = trainGbdt(X(full), Y(full), { depth: bestGb.depth, rounds: bestGb.rounds })
  const rfm = fitRfm(full.map((r) => r.rfm))
  const rfmModel = trainLogistic(full.map((r) => [opts.rfmSign * rfmScore(rfm, r.rfm)]), Y(full), { epochs: 300, l2: 0 })
  const models = { logistic, gbdt: gbdtFull as GbdtModel }

  const yTest = Y(test)
  const preds: Record<Learned, number[]> = {
    logistic: test.map((r) => predictLearned(models, 'logistic', r.x)),
    gbdt: test.map((r) => predictLearned(models, 'gbdt', r.x)),
    ensemble: test.map((r) => predictLearned(models, 'ensemble', r.x)),
  }
  const rfmScores = test.map((r) => opts.rfmSign * rfmScore(rfm, r.rfm))

  const evaluations: Evaluation[] = (['logistic', 'gbdt', 'ensemble'] as Learned[]).map((a) => ({
    algorithm: a,
    ...metricsOf(preds[a], yTest, true, bootstrapRounds),
    roc: rocCurve(preds[a], yTest),
    pr: prCurve(preds[a], yTest),
    gain: gainCurve(preds[a], yTest),
    calibration: calibration(preds[a], yTest),
    valueGain: valueGain(preds[a], test),
  }))
  for (const e of evaluations) e.apDiffVsRfmCI = bootstrapDiffCI(averagePrecision, preds[e.algorithm as Learned], rfmScores, yTest, bootstrapRounds)
  evaluations.push({
    algorithm: 'rfm',
    ...metricsOf(rfmScores, yTest, false, bootstrapRounds),
    roc: rocCurve(rfmScores, yTest),
    pr: prCurve(rfmScores, yTest),
    gain: gainCurve(rfmScores, yTest),
    valueGain: valueGain(rfmScores, test),
  })

  // 5. Importance par permutation : baisse d'AUC quand on mélange une variable
  let seed = 11
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const importance = (['logistic', 'gbdt'] as Learned[]).map((a) => {
    const baseAuc = auc(preds[a], yTest)
    const values = featureNames.map((feature, j) => {
      const col = test.map((r) => r.x[j])
      for (let i = col.length - 1; i > 0; i--) {
        const k = Math.floor(rand() * (i + 1));
        [col[i], col[k]] = [col[k], col[i]]
      }
      const s = test.map((r, i) => {
        const x = [...r.x]
        x[j] = col[i]
        return predictLearned(models, a, x)
      })
      return { feature, drop: baseAuc - auc(s, yTest) }
    })
    return { algorithm: a, values: values.sort((u, v) => v.drop - u.drop) }
  })

  // 6. Équité : le modèle se comporte-t-il de la même façon selon l'âge et la région ?
  const pSel = preds[selected]
  const fairness = (['age', 'region'] as const).map((by) => ({ by, groups: fairnessBy(by, test, pSel) })).filter((f) => f.groups.length)

  // 7. Test temporel : entraîner sur les photos anciennes, tester sur les plus récentes (donateurs du test)
  let temporal: ExperimentResult['temporal']
  const periods = [...new Set(rows.map((r) => r.period))].sort((a, b) => a - b)
  if (periods.length >= 6) {
    // les 4 dates les plus récentes forment le test temporel (assez d'exemples pour une mesure stable)
    const testPeriods = periods.slice(-4)
    const early = rows.filter((r) => r.period < testPeriods[0] && splitOf(r.group) !== 'test')
    const late = rows.filter((r) => r.period >= testPeriods[0] && splitOf(r.group) === 'test')
    if (pos(early) >= 10 && pos(late) >= 3) {
      const lm = trainLogistic(X(early), Y(early), { epochs, l2: bestLog.l2 })
      const gm = trainGbdt(X(early), Y(early), { depth: bestGb.depth, rounds: bestGb.rounds })
      const s = late.map((r) => predictLearned({ logistic: lm, gbdt: gm }, selected, r.x))
      const yl = Y(late)
      temporal = { trainPeriods: periods.length - 4, testPeriods: 4, nTest: late.length, auc: auc(s, yl), ap: averagePrecision(s, yl), p50: precisionAtK(s, yl, 50) }
    }
  }

  // 8. Courbe d'apprentissage (optionnelle, coûteuse)
  let learningCurve: ExperimentResult['learningCurve']
  if (opts.learningCurve) {
    learningCurve = [0.1, 0.25, 0.5, 1].map((fraction) => {
      const sub = full.filter((_, i) => (i * 2654435761) % 1000 < fraction * 1000)
      const lm = trainLogistic(X(sub), Y(sub), { epochs, l2: bestLog.l2 })
      const gm = trainGbdt(X(sub), Y(sub), { depth: bestGb.depth, rounds: bestGb.rounds })
      const s = test.map((r) => predictLearned({ logistic: lm, gbdt: gm }, selected, r.x))
      return { fraction, n: sub.length, ap: averagePrecision(s, yTest), auc: auc(s, yTest) }
    })
  }

  const means = featureNames.map((_, j) => full.reduce((s, r) => s + r.x[j], 0) / full.length)

  return {
    featureNames,
    nTrain: train.length,
    nVal: val.length,
    nTest: test.length,
    positivesTrain: pos(train),
    baseRate: pos(rows) / rows.length,
    selected,
    hyper: { l2: bestLog.l2, depth: bestGb.depth, rounds: bestGb.rounds, validation },
    evaluations,
    importance,
    fairness,
    temporal,
    learningCurve,
    logistic,
    gbdt: { base: gbdtFull.base, learningRate: gbdtFull.learningRate, trees: gbdtFull.trees, gain: gbdtFull.gain },
    rfm,
    rfmSign: opts.rfmSign,
    rfmModel,
    means,
  }
}
