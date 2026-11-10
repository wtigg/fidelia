// Métriques écrites à la main, comparées aux valeurs de scikit-learn
// (average_precision_score, roc_auc_score) calculées à l'avance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auc, averagePrecision } from '../src/ml/metrics.ts'

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

test('sans égalités : AP et AUC = scikit-learn', () => {
  const s = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
  const y = [1, 1, 0, 1, 0, 0]
  close(averagePrecision(s, y), 0.9166666666666665)
  close(auc(s, y), 0.888888888888889)
})

test('avec égalités : AP et AUC = scikit-learn', () => {
  const s = [0.9, 0.8, 0.8, 0.7, 0.5, 0.5, 0.5, 0.2, 0.1, 0.1]
  const y = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0]
  close(averagePrecision(s, y), 0.6976190476190476)
  close(auc(s, y), 0.68)
})

test("le résultat ne dépend pas de l'ordre des lignes", () => {
  const s = [0.5, 0.5, 0.5, 0.2]
  const y = [1, 0, 0, 1]
  close(averagePrecision(s, y), averagePrecision([...s].reverse(), [...y].reverse()))
  close(auc(s, y), auc([...s].reverse(), [...y].reverse()))
})
