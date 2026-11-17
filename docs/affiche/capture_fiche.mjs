// Capture la fiche d'un donateur « Relancer » dans l'application, pour l'affiche.
// Largeur de 540 px : le texte reste lisible sur l'affiche sans que la carte du risque passe sur deux colonnes.
// Prérequis : npm run build (le dossier dist/ doit exister) et Google Chrome.
// Usage : node docs/affiche/capture_fiche.mjs
// Produit docs/affiche/fiche-risque.png, fiche-raisons.png et fiche-historique.png.
// Donateur choisi : Olivier Gauthier (données synthétiques, graine 42), 3 paiements échoués sur 90 jours.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..', '..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT_APP = 4179
const PORT_CDP = 9333
const DONATEUR = ['Olivier', 'Gauthier']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const vite = spawn('npx', ['vite', 'preview', '--port', String(PORT_APP), '--strictPort'], { cwd: RACINE, stdio: 'ignore' })
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT_CDP}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fidelia-'))}`, 'about:blank'], { stdio: 'ignore' })

try {
  await sleep(4000)
  const page = (await (await fetch(`http://localhost:${PORT_CDP}/json`)).json()).find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const attente = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && attente.has(m.id)) { attente.get(m.id)(m); attente.delete(m.id) }
  }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; attente.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value

  await send('Emulation.setDeviceMetricsOverride', { width: 540, height: 2400, deviceScaleFactor: 4, mobile: false })
  await send('Page.navigate', { url: `http://localhost:${PORT_APP}/#/donateurs` })
  await sleep(5000)
  await ev(`[...document.querySelectorAll('button')].find((b) => b.innerText.startsWith('Mensuel')).click()`)
  await sleep(600)
  for (let k = 0; k < 10; k++) {
    await ev(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.startsWith('Afficher plus')); b && b.click() })()`)
    await sleep(250)
  }
  await ev(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('${DONATEUR[0]}') && r.innerText.includes('${DONATEUR[1]}') && r.innerText.includes('Relancer')).click()`)
  await sleep(6000) // fin des animations du graphique
  const boites = await ev(`(() => { const a = document.querySelector('aside.relative');
    const r = [...a.querySelectorAll('.space-y-5 > *')].slice(0, 3).map((e) => e.getBoundingClientRect());
    return r.map((b) => ({ x: b.left, y: b.top, width: b.width, height: b.height })) })()`)
  const noms = ['risque', 'raisons', 'historique']
  for (let i = 0; i < noms.length; i++) {
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...boites[i], scale: 1 } })
    writeFileSync(join(ICI, `fiche-${noms[i]}.png`), Buffer.from(r.result.data, 'base64'))
  }
  ws.close()
  console.log('Captures écrites dans', ICI)
} finally {
  chrome.kill()
  vite.kill()
}
