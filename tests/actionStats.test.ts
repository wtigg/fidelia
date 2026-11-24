// « Solliciter plus » et les autres actions : même définition (action finale) pour le tableau de bord et Automatisations.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { scoreAll } from '../src/ml/pipeline.ts'
import { actionStats, donorsForAction } from '../src/lib/actionStats.ts'
import type { ActionType } from '../src/lib/types.ts'

const shipped = JSON.parse(readFileSync(new URL('../src/data/model.json', import.meta.url), 'utf8'))
const ds = generateDemo(4000, 42)
const scores = scoreAll(ds, shipped.reports)
const TYPES: ActionType[] = ['churn_prevention', 'upgrade_amount', 'upgrade_one_time', 'upgrade_annual', 'reactivation', 'thank']

test('actionStats compte l\'action finale de chaque donateur (une seule par donateur)', () => {
  for (const t of TYPES) {
    const list = scores.filter((s) => s.action === t)
    assert.deepEqual(actionStats(scores, t), { count: list.length, value: list.reduce((a, s) => a + s.expectedValue, 0) })
    assert.equal(donorsForAction(scores, t).length, list.length)
  }
  const total = TYPES.reduce((a, t) => a + actionStats(scores, t).count, 0)
  assert.equal(total, scores.filter((s) => s.action).length)
})

test('Solliciter plus : un mensuel à risque d\'arrêt n\'est pas compté (priorité à « éviter l\'arrêt »)', () => {
  for (const s of donorsForAction(scores, 'upgrade_amount')) assert.equal(s.segment, 'monthly')
  const churnFirst = scores.filter((s) => s.action === 'churn_prevention' && (s.upgradeProb ?? 0) >= 0.043)
  for (const s of churnFirst) assert.ok(!donorsForAction(scores, 'upgrade_amount').includes(s))
})

test("Visite guidée : le donateur de l'affiche (Olivier Gauthier) est à relancer, 35 %, 3 paiements échoués, 63 $", () => {
  const byId = new Map(ds.donors.map((d) => [d.id, d]))
  const demo = scores.find((s) => {
    const d = byId.get(s.donorId)
    return s.action === 'churn_prevention' && d?.firstName === 'Olivier' && d.lastName === 'Gauthier' && s.features.failed90d > 0
  })
  assert.ok(demo, 'Olivier Gauthier doit figurer dans la liste « Relancer »')
  assert.equal(Math.round(demo.actionProb * 100), 35)
  assert.equal(demo.features.failed90d, 3)
  assert.equal(Math.round(demo.expectedValue), 63)
})
