// Bout en bout : réentraîner sur la démo (graine 42) redonne les choix du modèle versionné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { MIN_POSITIVES, MODEL_KINDS, governanceDecision, positivesOf, scoreAll, trainAll } from '../src/ml/pipeline.ts'
import { FEATURE_KEYS, stable, toVector } from '../src/ml/features.ts'
import { roundForStorage } from '../src/ml/serialize.ts'

const shipped = JSON.parse(readFileSync(new URL('../src/data/model.json', import.meta.url), 'utf8')) as {
  reports: Record<string, { selected: string; deployed: string }>
}
const ds = generateDemo(4000, 42)
const reports = trainAll(ds)

test('gouvernance : hausse du don retombe sur la règle RFM', () => {
  assert.equal(reports.upgrade?.deployed, 'rfm')
})

test('mêmes modèles retenus et déployés que src/data/model.json', () => {
  for (const k of MODEL_KINDS) {
    assert.equal(reports[k]?.selected, shipped.reports[k].selected, `${k} : selected`)
    assert.equal(reports[k]?.deployed, shipped.reports[k].deployed, `${k} : deployed`)
  }
})

test('modèle sérialisé (arrondi pour model.json) : mêmes scores qu\'en pleine précision', () => {
  const stored = JSON.parse(JSON.stringify(roundForStorage(reports))) as typeof reports
  assert.deepEqual(scoreAll(ds, stored), scoreAll(ds, reports))
})

test('RD1 : moins de 100 cas positifs dans l\'historique → méthode habituelle, automatiquement', () => {
  const churn = reports.churn!
  assert.notEqual(governanceDecision(churn), 'rfm')
  // même rapport, mais un historique dix fois plus petit (le taux de base ne change pas)
  const small = { ...churn, nTrain: Math.round(churn.nTrain / 10), nVal: Math.round(churn.nVal / 10), nTest: Math.round(churn.nTest / 10) }
  assert.ok(positivesOf(small) < MIN_POSITIVES)
  assert.equal(governanceDecision(small), 'rfm')
})

test('variables identiques sur tous les moteurs : un écart au dernier chiffre de Math.log disparaît', () => {
  // Chrome 157 : log(3) = 1.0986122886681098 ; Node 24 : 1.0986122886681096
  assert.equal(stable(1.0986122886681098), stable(1.0986122886681096))
  assert.equal(stable(0), 0)
  // variables passées par un logarithme : déjà arrondies (les autres ne passent que par + − × ÷, exacts partout)
  const logged = ['recencyDays', 'amount12m', 'tenureMonths', 'giftsLifetime', 'avgGift', 'amountTrend', 'lastGiftRatio'].map((k) => FEATURE_KEYS.indexOf(k as never))
  for (const s of scoreAll(ds, reports).slice(0, 200)) {
    const x = toVector(s.features)
    for (const j of logged) assert.equal(x[j], stable(x[j]))
  }
})
