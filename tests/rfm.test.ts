// Règle RFM : récence inversée (6 - note), fréquence et montant croissants, score entre 3 et 15.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitRfm, rfmScore } from '../src/ml/rfm.ts'

const rows = Array.from({ length: 100 }, (_, i) => ({ recency: i * 5, frequency: i, monetary: i * 10 }))
const rule = fitRfm(rows)
const base = { recency: 250, frequency: 50, monetary: 500 }

test('le score croît avec la fréquence et le montant', () => {
  assert.ok(rfmScore(rule, { ...base, frequency: 95 }) > rfmScore(rule, base))
  assert.ok(rfmScore(rule, { ...base, monetary: 950 }) > rfmScore(rule, base))
})

test('le score décroît avec la récence (jours depuis le dernier don)', () => {
  assert.ok(rfmScore(rule, { ...base, recency: 490 }) < rfmScore(rule, base))
})

test('score minimal 3, maximal 15', () => {
  assert.equal(rfmScore(rule, { recency: 1e9, frequency: -1, monetary: -1 }), 3)
  assert.equal(rfmScore(rule, { recency: -1, frequency: 1e9, monetary: 1e9 }), 15)
})
