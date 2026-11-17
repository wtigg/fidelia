// Vérifie que le navigateur affiche les mêmes chiffres que le rapport versionné reports/impact-42.json (bloc « app »).
// check:repro ne tourne que dans Node ; or Math.log peut différer d'un moteur à l'autre au dernier chiffre.
// Ce script sert le build (vite preview), lit la page Impact dans Chrome sans interface (profil neuf) et compare.
// Lancement : npm run check:browser   (Chrome : variable CHROME, sinon l'emplacement macOS par défaut)
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PORT ?? 4791)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(CHROME)) {
  console.error(`Chrome introuvable (${CHROME}). Indiquez son chemin dans la variable CHROME.`)
  process.exit(2)
}
if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('dist/ absent : lancez npm run build.')
  process.exit(2)
}

const report = JSON.parse(readFileSync(join(root, 'reports/impact-42.json'), 'utf8'))
// la page Impact s'ouvre à 300 contacts
const ref = report.app.impact.find((c) => c.capacity === 300)

const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
const profile = mkdtempSync(join(tmpdir(), 'fidelia-chrome-'))
try {
  let html = ''
  for (let attempt = 0; attempt < 20 && !html.includes('data-check="gain"'); attempt++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      html = execFileSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--virtual-time-budget=8000', '--dump-dom', `http://localhost:${PORT}/#/impact`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 60_000,
      })
    } catch {
      html = ''
    }
  }
  const attr = (check, name) => {
    const tag = html.match(new RegExp(`<[^>]*data-check="${check}"[^>]*>`))?.[0]
    const v = tag?.match(new RegExp(`${name}="([^"]*)"`))?.[1]
    return v === undefined ? NaN : Number(v)
  }
  const rows = [
    ...ref.byModel.map((m) => ({ label: `valeur en jeu ${m.kind}`, page: attr(`stake-${m.kind}`, 'data-value'), report: m.atStake })),
    { label: 'modèle (300 contacts)', page: attr('gain', 'data-model'), report: ref.total.model },
    { label: 'méthode habituelle (300 contacts)', page: attr('gain', 'data-rfm'), report: ref.total.rfm },
  ]
  // le rapport arrondit au cent : on tolère un demi-cent
  const bad = rows.filter((r) => !(Math.abs(r.page - r.report) <= 0.006))
  for (const r of rows) console.log(`${bad.includes(r) ? '✗' : '✓'} ${r.label} : page ${Number.isNaN(r.page) ? 'introuvable' : r.page.toFixed(2)} · rapport ${r.report.toFixed(2)}`)
  if (bad.length) {
    console.error(`Le navigateur n'affiche pas les chiffres de reports/impact-42.json (${bad.length} écart(s)).`)
    process.exitCode = 1
  } else {
    console.log('Navigateur identique au rapport : page Impact = reports/impact-42.json (bloc app, 300 contacts).')
  }
} finally {
  server.kill()
  rmSync(profile, { recursive: true, force: true })
}
