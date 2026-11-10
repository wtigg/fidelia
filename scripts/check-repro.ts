// Reproductibilité : réentraîne sur la graine 42 et compare au rapport versionné reports/synthetique-42.json.
// Seuls l'horodatage (trainedAt) et la durée (ms) peuvent changer. Ne dépend pas de git (utilisable dans Docker).
// Lancement : npm run check:repro
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const IGNORED = new Set(['trainedAt', 'ms'])
const TOLERANCE = 1e-9 // écart numérique toléré (arrondis flottants d'une machine à l'autre)
const reference = fileURLToPath(new URL('../reports/synthetique-42.json', import.meta.url))
const evaluate = fileURLToPath(new URL('./evaluate.ts', import.meta.url))

const dir = mkdtempSync(join(tmpdir(), 'fidelia-repro-'))
const produced = join(dir, 'synthetique-42.json')
try {
  execFileSync(process.execPath, ['--import', 'tsx', evaluate, '42', produced], { stdio: ['ignore', 'ignore', 'inherit'] })
  const diffs: string[] = []
  const walk = (a: unknown, b: unknown, path: string) => {
    if (diffs.length >= 20) return
    if (typeof a === 'number' && typeof b === 'number') {
      if (!(a === b || Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(a)))) diffs.push(`${path} : ${a} → ${b}`)
      return
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return void diffs.push(`${path} : type différent`)
      const keys = new Set([...Object.keys(a), ...Object.keys(b)])
      for (const k of keys) if (!IGNORED.has(k)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
      return
    }
    if (a !== b) diffs.push(`${path} : ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
  }
  walk(JSON.parse(readFileSync(reference, 'utf8')), JSON.parse(readFileSync(produced, 'utf8')), 'rapport')
  if (diffs.length) {
    console.error(`Non reproductible : le rapport graine 42 diffère de reports/synthetique-42.json (${diffs.length >= 20 ? '20 premiers écarts' : `${diffs.length} écart(s)`})`)
    for (const d of diffs) console.error(`  ${d}`)
    process.exitCode = 1
  } else {
    console.log('Reproductible : rapport graine 42 identique à reports/synthetique-42.json (hors trainedAt et ms).')
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
