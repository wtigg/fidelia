// Entraîne les 4 modèles sur le jeu de démonstration et sérialise le résultat : npm run train
// Le fichier src/data/model.json est le « modèle versionné » chargé par l'application au démarrage.
import { writeFileSync } from 'node:fs'
import { generateDemo } from '../src/data/generate.ts'
import { trainAll } from '../src/ml/pipeline.ts'

const t0 = performance.now()
const ds = generateDemo()
const reports = trainAll(ds, (k) => process.stdout.write(`${k}… `))
const trainedAt = new Date().toISOString()
const version = `v${trainedAt.slice(0, 10).replace(/-/g, '')}.${trainedAt.slice(11, 16).replace(':', '')}`
const round = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v)
writeFileSync(new URL('../src/data/model.json', import.meta.url), JSON.stringify({ version, trainedAt, dataset: { source: ds.source, donors: ds.donors.length, seed: 42 }, reports }, round))
console.log(`\n${version} écrit dans src/data/model.json en ${Math.round(performance.now() - t0)} ms`)
