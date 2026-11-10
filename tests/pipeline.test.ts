// Bout en bout : réentraîner sur la démo (graine 42) redonne les choix du modèle versionné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { MODEL_KINDS, trainAll } from '../src/ml/pipeline.ts'

const shipped = JSON.parse(readFileSync(new URL('../src/data/model.json', import.meta.url), 'utf8')) as {
  reports: Record<string, { selected: string; deployed: string }>
}
const reports = trainAll(generateDemo(4000, 42))

test('gouvernance : hausse du don retombe sur la règle RFM', () => {
  assert.equal(reports.upgrade?.deployed, 'rfm')
})

test('mêmes modèles retenus et déployés que src/data/model.json', () => {
  for (const k of MODEL_KINDS) {
    assert.equal(reports[k]?.selected, shipped.reports[k].selected, `${k} : selected`)
    assert.equal(reports[k]?.deployed, shipped.reports[k].deployed, `${k} : deployed`)
  }
})
