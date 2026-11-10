// Gouvernance : bornes de R1 et R2, décision de déploiement (R1 ET R2), exclusion des petites tranches dans R6,
// et repli RFM de predictReport (inversion de log1p par expm1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REQUIREMENTS } from '../src/lib/requirements.ts'
import { FEATURE_KEYS, toVector } from '../src/ml/features.ts'
import { predict as predictLogistic } from '../src/ml/logistic.ts'
import { governanceDecision, predictReport, type ModelReport } from '../src/ml/pipeline.ts'
import { rfmScore, type RfmRule } from '../src/ml/rfm.ts'
import type { Evaluation, GroupStat } from '../src/ml/experiment.ts'
import type { Features } from '../src/lib/types.ts'

const check = (id: string, r: ModelReport) => REQUIREMENTS.find((q) => q.id === id)!.check(r)

const evaluation = (algorithm: Evaluation['algorithm'], ap: number, diff?: [number, number]): Evaluation =>
  ({ algorithm, ap, apCI: [ap - 0.01, ap + 0.01], apDiffVsRfmCI: diff, auc: 0.7, p50: 0.2, brier: 0.04 }) as unknown as Evaluation

const rule: RfmRule = { recency: [30, 90, 180, 365], frequency: [2, 5, 10, 20], monetary: [15, 30, 60, 120] }

/** Faux rapport minimal : seuls les champs lus par les requis et par predictReport sont remplis */
function fake(opts: { ap?: number; baseRate?: number; diff?: [number, number]; ageGroups?: GroupStat[] } = {}): ModelReport {
  const ap = opts.ap ?? 0.3
  return {
    kind: 'churn',
    selected: 'gbdt',
    deployed: 'gbdt',
    deployedAuto: true,
    baseRate: opts.baseRate ?? 0.05,
    evaluations: [evaluation('gbdt', ap, opts.diff ?? [0.02, 0.08]), evaluation('rfm', 0.1)],
    fairness: [{ by: 'age', groups: opts.ageGroups ?? [] }],
    rfm: rule,
    rfmSign: 1,
    rfmModel: { weights: [0.4], bias: -3, mean: [9], std: [3] },
  } as unknown as ModelReport
}

const group = (name: string, n: number, positives: number, meanPred: number): GroupStat =>
  ({ group: name, n, baseRate: positives / n, meanPred, auc: null, selectionRatio: 1, precisionTop20: null })

test('R1 : AUC-PR ≥ 2 × taux de base (borne incluse)', () => {
  assert.equal(check('R1', fake({ ap: 0.1001, baseRate: 0.05 })).ok, true)
  assert.equal(check('R1', fake({ ap: 0.1, baseRate: 0.05 })).ok, true)
  assert.equal(check('R1', fake({ ap: 0.0999, baseRate: 0.05 })).ok, false)
})

test('R2 : borne basse de l\'IC de l\'écart vs RFM strictement au-dessus de 0', () => {
  assert.equal(check('R2', fake({ diff: [-0.01, 0.05] })).ok, false)
  assert.equal(check('R2', fake({ diff: [0, 0.05] })).ok, false)
  assert.equal(check('R2', fake({ diff: [0.001, 0.05] })).ok, true)
})

test('décision : le modèle seulement si R1 ET R2, sinon la règle RFM', () => {
  assert.equal(governanceDecision(fake({ ap: 0.3, baseRate: 0.05, diff: [0.001, 0.05] })), 'gbdt')
  assert.equal(governanceDecision(fake({ ap: 0.0999, baseRate: 0.05, diff: [0.001, 0.05] })), 'rfm', 'R1 échoue')
  assert.equal(governanceDecision(fake({ ap: 0.3, baseRate: 0.05, diff: [-0.01, 0.05] })), 'rfm', 'R2 échoue')
  assert.equal(governanceDecision(fake({ ap: 0.0999, baseRate: 0.05, diff: [-0.01, 0.05] })), 'rfm', 'les deux échouent')
})

test('R6 : une tranche trop petite (moins de 5 positifs) est exclue du contrôle', () => {
  const ok = [group('40 à 59 ans', 500, 50, 0.1), group('60 à 69 ans', 400, 40, 0.11)]
  // 70+ : n = 126 mais 2 positifs seulement, ratio prédit / observé très loin de 1 → ignorée
  const r = fake({ ageGroups: [...ok, group('70 ans et plus', 126, 2, 0.2)] })
  assert.equal(check('R6', r).ok, true)
  // Même tranche avec assez de positifs : elle compte, et le requis échoue
  assert.equal(check('R6', fake({ ageGroups: [...ok, group('70 ans et plus', 126, 20, 0.5)] })).ok, false)
})

test('R6 : tranche « Inconnu » et tranches de moins de 100 donateurs exclues ; aucune tranche = échec', () => {
  const ok = [group('40 à 59 ans', 500, 50, 0.1)]
  assert.equal(check('R6', fake({ ageGroups: [...ok, group('Inconnu', 800, 80, 0.5), group('Moins de 25 ans', 99, 20, 0.9)] })).ok, true)
  assert.equal(check('R6', fake({ ageGroups: [] })).ok, false)
})

const features = (over: Partial<Features>): Features =>
  ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0])), ...over }) as Features

test('repli RFM : expm1(toVector) redonne les valeurs brutes de récence, fréquence et montant', () => {
  const idx = { recency: FEATURE_KEYS.indexOf('recencyDays'), frequency: FEATURE_KEYS.indexOf('giftsLifetime'), monetary: FEATURE_KEYS.indexOf('avgGift') }
  for (const f of [features({ recencyDays: 47, giftsLifetime: 7, avgGift: 42.5 }), features({ recencyDays: 400, giftsLifetime: 1, avgGift: 10 }), features({ recencyDays: 3, giftsLifetime: 25, avgGift: 250 })]) {
    const x = toVector(f)
    const back = { recency: Math.expm1(x[idx.recency]), frequency: Math.expm1(x[idx.frequency]), monetary: Math.expm1(x[idx.monetary]) }
    assert.ok(Math.abs(back.recency - f.recencyDays) < 1e-9)
    assert.ok(Math.abs(back.frequency - f.giftsLifetime) < 1e-9)
    assert.ok(Math.abs(back.monetary - f.avgGift) < 1e-9)
    const raw = { recency: f.recencyDays, frequency: f.giftsLifetime, monetary: f.avgGift }
    assert.equal(rfmScore(rule, back), rfmScore(rule, raw))
  }
})

test('predictReport en mode RFM = régression logistique sur le score RFM des valeurs brutes', () => {
  const r = { ...fake(), deployed: 'rfm' } as ModelReport
  const f = features({ recencyDays: 47, giftsLifetime: 7, avgGift: 42.5 })
  const expected = predictLogistic(r.rfmModel, [r.rfmSign * rfmScore(rule, { recency: 47, frequency: 7, monetary: 42.5 })])
  assert.ok(Math.abs(predictReport(r, toVector(f)) - expected) < 1e-9)
  // Un meilleur profil RFM donne une probabilité plus haute (rfmSign = +1)
  const better = features({ recencyDays: 3, giftsLifetime: 25, avgGift: 250 })
  assert.ok(predictReport(r, toVector(better)) > predictReport(r, toVector(f)))
})
