// Vidéo de secours de la démo (docs/PRESENTATION.md, « Démonstration : script de 5 minutes »).
// Enregistre l'application sans fenêtre (Chromium headless + capture d'écran CDP), ajoute une voix off
// française (macOS `say`), des sous-titres incrustés, un carton titre et un carton de fin.
//
// Lancement (depuis la racine du dépôt) :
//   npm run build
//   PLAYWRIGHT_MODULE=/chemin/vers/node_modules/playwright/index.mjs node docs/video/build_video.mjs
// Variables utiles : VOICE (défaut Amélie, fr_CA), RATE (mots/min, défaut 178), PORT (défaut 4817),
// APP_URL (sinon le script lance `vite preview` sur dist/), WORK (dossier temporaire).
// Sorties : docs/video/Demo-Fidelia.mp4 et docs/video/narration.srt
// Pour changer le texte : modifier LINES (sub = sous-titre, say = prononciation si différente).
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const OUT_DIR = join(root, 'docs/video')
const WORK = process.env.WORK ?? join(tmpdir(), 'fidelia-video')
const VOICE = process.env.VOICE ?? 'Amélie'
const RATE = process.env.RATE ?? '170'
const PORT = Number(process.env.PORT ?? 4817)
const TITLE_S = 3.5
const END_S = 5
const SITE = 'https://wtigg.github.io/fidelia/'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

// ---------- Narration : une entrée = un clip audio = un sous-titre ----------
const LINES = {
  h1: { sub: "Moins d'un donateur sur deux redonne l'année suivante." },
  h2: { sub: "Or garder un donateur coûte environ 7 fois moins cher que d'en trouver un nouveau.", say: "Or, garder un donateur coûte environ sept fois moins cher que d'en trouver un nouveau." },
  h3: { sub: "Au Canada, plus de la moitié des organismes de moins de 1 M$ confient leurs données à quelqu'un qui n'a ni formation ni mandat pour ça.", say: "Au Canada, plus de la moitié des organismes de moins d'un million de dollars confient leurs données à quelqu'un qui n'a ni formation, ni mandat pour ça." },
  h4: { sub: "Fidélia leur dit par qui commencer, et n'utilise l'IA que là où elle fait mieux que la méthode habituelle.", say: "Fidélia leur dit par qui commencer, et n'utilise l'I.A. que là où elle fait mieux que la méthode habituelle." },
  h5: { sub: 'Voyons-le avec la visite guidée.' },
  d1: { sub: 'Voici Les Petits Pas, un organisme fictif avec 4 000 donateurs.', say: 'Voici Les Petits Pas, un organisme fictif avec quatre mille donateurs.' },
  d2: { sub: 'En haut, la valeur des dons mensuels à risque : 8 406 $ par an.', say: 'En haut, la valeur des dons mensuels à risque : huit mille quatre cent six dollars par an.' },
  d3: { sub: 'Plus bas, les priorités du jour, classées par dollars à gagner.' },
  r1: { sub: 'Fidélia dit par où commencer : qui relancer, qui remercier, qui solliciter.' },
  r3: { sub: 'Chaque ligne dit quoi faire, et combien de dons sont en jeu sur un an.' },
  r2: { sub: 'Les listes sont classées par dollars à gagner : les plus utiles sont en haut.' },
  f1: { sub: "Voici la fiche d'un donateur à relancer : Olivier Gauthier." },
  f2: { sub: "Son risque d'arrêter son don mensuel : 35 %.", say: "Son risque d'arrêter son don mensuel : trente-cinq pour cent." },
  f2b: { sub: 'Ses dons espérés sur un an : 63 $.', say: 'Ses dons espérés sur un an : soixante-trois dollars.' },
  f3: { sub: 'Les raisons sont écrites en mots simples : dernier don il y a 101 jours, et 3 paiements échoués sur 90 jours.', say: 'Les raisons sont écrites en mots simples : dernier don il y a cent un jours, et trois paiements échoués sur quatre-vingt-dix jours.' },
  f4: { sub: 'Dans son historique sur 24 mois, les paiements échoués sont en rouge.', say: 'Dans son historique sur vingt-quatre mois, les paiements échoués sont en rouge.' },
  f5: { sub: 'Le modèle explique sa décision. Vous décidez : un clic prépare le courriel.' },
  i1: { sub: "Passons à l'impact. Ici, l'équipe peut contacter 300 donateurs.", say: "Passons à l'impact. Ici, l'équipe peut contacter trois cents donateurs." },
  i2: { sub: 'Pour la liste à relancer, Fidélia vise 3,1 fois plus de dons menacés que la méthode habituelle, quel que soit l\'effet du courriel.', say: 'Pour la liste à relancer, Fidélia vise trois virgule un fois plus de dons menacés que la méthode habituelle, quel que soit l\'effet du courriel.' },
  i3: { sub: 'Pour les quatre listes ensemble, c\'est 3 fois plus, mais ce total dépend de l\'effet supposé des courriels.', say: 'Pour les quatre listes ensemble, c\'est trois fois plus, mais ce total dépend de l\'effet supposé des courriels.' },
  i4: { sub: 'Avec 100 contacts seulement : 6,1 fois plus pour la liste à relancer, et 4,8 fois plus au total.', say: 'Avec cent contacts seulement : six virgule un fois plus pour la liste à relancer, et quatre virgule huit fois plus au total.' },
  i5: { sub: 'Ce sont des donateurs fictifs.' },
  i6: { sub: "On mesure bien le ciblage. L'effet d'un courriel, lui, est une hypothèse, réglable ici." },
  i7: { sub: 'Les donateurs mis de côté exprès le mesureront.' },
  m1: { sub: 'Le modèle apprend des dons passés.' },
  m2: { sub: "On ne l'utilise que s'il remplit nos deux conditions : trouver les bons donateurs 2 fois mieux que le hasard, et mieux que la méthode habituelle.", say: "On ne l'utilise que s'il remplit nos deux conditions : trouver les bons donateurs deux fois mieux que le hasard, et mieux que la méthode habituelle." },
  m2b: { sub: 'Pour le risque d\'arrêt, parmi les 50 premiers noms proposés, 34 % sont de vrais cas, contre 8 % avec la méthode habituelle.', say: 'Pour le risque d\'arrêt, parmi les cinquante premiers noms proposés, trente-quatre pour cent sont de vrais cas, contre huit pour cent avec la méthode habituelle.' },
  m3: { sub: "Pour la hausse du don, il ne fait pas mieux : l'outil garde donc la méthode habituelle." },
  m4: { sub: 'Sur 18 824 vrais donateurs, le modèle remplit nos deux conditions pour repérer qui donnera plus que son dernier don.', say: 'Sur dix-huit mille huit cent vingt-quatre vrais donateurs, le modèle remplit nos deux conditions pour repérer qui donnera plus que son dernier don.' },
  m5: { sub: "Mais pas encore pour la réactivation : dans l'application, ce modèle reste à l'essai. Nous le disons." },
  c1: { sub: 'Lundi matin, les courriels de la semaine sont prêts.' },
  c2: { sub: 'Le courriel parle de la carte expirée, sans montant inventé.' },
  c4: { sub: 'Lors des envois groupés, environ 10 % des donateurs sont mis de côté exprès, pour mesurer si les courriels rapportent vraiment.', say: 'Lors des envois groupés, environ dix pour cent des donateurs sont mis de côté exprès, pour mesurer si les courriels rapportent vraiment.' },
  c3: { sub: "Je relis, j'approuve, j'envoie. Rien ne part sans un humain." },
  e1: { sub: "Un dernier point : l'équité." },
  e2: { sub: 'Pour proposer le don mensuel, le modèle choisit 1,8 fois plus souvent les 70 ans et plus.', say: 'Pour proposer le don mensuel, le modèle choisit un virgule huit fois plus souvent les soixante-dix ans et plus.' },
  e3: { sub: "C'est moins que leur vrai taux de passage au mensuel : il les sous-estime un peu,", say: "C'est moins que leur vrai taux de passage au mensuel : il les sous-estime un peu," },
  e4: { sub: "et surestime les 35 à 54 ans, qu'on risque de trop solliciter.", say: "et surestime les trente-cinq à cinquante-quatre ans, qu'on risque de trop solliciter." },
  e5: { sub: "L'âge n'est pas utilisé, mais d'autres indices le reflètent. On le mesure, et on le revérifiera sur de vraies données." },
  z1: { sub: 'Simple, mesurable, responsable. Un humain décide toujours.' },
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

rmSync(WORK, { recursive: true, force: true })
mkdirSync(join(WORK, 'frames'), { recursive: true })
mkdirSync(join(WORK, 'audio'), { recursive: true })

// ---------- 1. Voix off ----------
for (const [id, l] of Object.entries(LINES)) {
  if (/—/.test(l.sub)) throw new Error(`tiret cadratin interdit : ${id}`)
  const aiff = join(WORK, 'audio', `${id}.aiff`)
  const wav = join(WORK, 'audio', `${id}.wav`)
  sh('say', ['-v', VOICE, '-r', RATE, '-o', aiff, l.say ?? l.sub])
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '2', wav])
  l.wav = wav
  l.dur = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).trim())
}
console.log(`voix : ${Object.keys(LINES).length} clips, ${Object.values(LINES).reduce((s, l) => s + l.dur, 0).toFixed(1)} s`)

// ---------- 2. Serveur ----------
let server
const APP = process.env.APP_URL ?? `http://localhost:${PORT}/`
if (!process.env.APP_URL) {
  if (!existsSync(join(root, 'dist/index.html'))) throw new Error('dist/ absent : lancez npm run build')
  server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
  await sleep(2500)
}

const browser = await chromium.launch()
try {
  // ---------- 3. Cartons ----------
  const card = async (file, html) => {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await p.setContent(`<html><head><style>
      body{margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:radial-gradient(circle at 30% 20%,#14532d,#0a2e1c 70%);color:#fff;font-family:-apple-system,'Helvetica Neue',sans-serif}
      .logo{width:150px;height:150px;border-radius:36px;background:#f6c544;display:flex;align-items:center;justify-content:center;font-size:90px;color:#0a2e1c;font-weight:800;margin-bottom:40px}
      h1{font-family:Georgia,serif;font-size:150px;margin:0;letter-spacing:-2px} p{font-size:46px;margin:18px 0 0;color:#d9f2e3}
      .s{font-size:36px;color:#f6c544;margin-top:50px}</style></head><body>${html}</body></html>`)
    await p.screenshot({ path: file })
    await p.close()
  }
  await card(join(WORK, 'title.png'), `<div class="logo">F</div><h1>Fidélia</h1><p>Garder ses donateurs, simplement</p><p class="s">Équipe 4 · HEC Montréal · TECH 60711</p>`)
  await card(join(WORK, 'end.png'), `<div class="logo">F</div><h1>Fidélia</h1><p>Essayez la démo :</p><p style="font-size:64px;color:#fff;font-weight:700">wtigg.github.io/fidelia</p><p class="s">Équipe 4 · HEC Montréal · TECH 60711</p>`)

  // ---------- 4. Enregistrement ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, locale: 'fr-CA' })
  await ctx.addInitScript(() => {
    const css = `
      [aria-labelledby="tour-title"]{bottom:150px !important}
      #vsub{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483646;max-width:1180px;width:max-content;
        background:rgba(12,20,16,.86);color:#fff;font:600 29px/1.32 -apple-system,'Helvetica Neue',sans-serif;text-align:center;
        padding:12px 26px;border-radius:14px;pointer-events:none;opacity:0;transition:opacity .15s}
      #vcur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px)}`
    const add = () => {
      if (document.getElementById('vsub')) return
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
      const s = document.createElement('div'); s.id = 'vsub'; document.body.appendChild(s)
      const c = document.createElement('div'); c.id = 'vcur'
      c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      document.body.appendChild(c)
      document.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)` }, true)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add()
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const frames = []
  let t0 = 0
  const now = () => (Date.now() - t0) / 1000
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    const i = frames.length
    const f = join(WORK, 'frames', `f${String(i).padStart(6, '0')}.jpg`)
    frames.push({ f, t: now() })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    await writeFile(f, Buffer.from(data, 'base64'))
  })

  await page.goto(APP)
  await page.waitForTimeout(2500)
  await page.mouse.move(1300, 40)

  const cues = []
  const sub = (text) => page.evaluate((t) => { const s = document.getElementById('vsub'); if (!s) return; if (t) s.textContent = t; s.style.opacity = t ? '1' : '0' }, text)
  // dit une ligne et attend la fin (plus une courte pause)
  const speak = async (id, pause = 350) => {
    const l = LINES[id]
    await sub(l.sub)
    cues.push({ id, start: now(), end: now() + l.dur })
    await sleep(l.dur * 1000)
    await sub('')
    await sleep(pause)
  }
  let mx = 1300, my = 40
  const moveTo = async (x, y, steps = 28) => { await page.mouse.move(x, y, { steps }); mx = x; my = y }
  const point = async (loc) => {
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 4000 })
      const b = await loc.boundingBox({ timeout: 4000 })
      await moveTo(b.x + b.width / 2, b.y + b.height / 2)
      return b
    } catch (e) { console.warn('élément introuvable :', String(loc)); return null }
  }
  const click = async (loc) => { await point(loc); await sleep(250); await loc.click(); await sleep(300) }
  const next = () => click(page.locator('[aria-labelledby=tour-title]').getByRole('button', { name: /Suivant|Terminer/ }))
  const smoothTo = (loc, block = 'start') => loc.evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block)
  const scrollBy = (dy) => page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), dy)

  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 })
  t0 = Date.now()
  await sleep(600)

  // 0. Accroche, sur le tableau de bord
  await speak('h1'); await speak('h2'); await speak('h3'); await speak('h4')
  const tourBtn = page.getByRole('button', { name: /Visite guidée/ })
  await point(tourBtn)
  await speak('h5', 150)
  await click(tourBtn)
  await sleep(1200)

  // 1. Tableau de bord
  await speak('d1')
  await point(page.getByText('Dons mensuels à risque').first())
  await speak('d2')
  await smoothTo(page.getByText('Priorités du jour').first(), 'center')
  await sleep(900)
  await point(page.getByText('Priorités du jour').first())
  await speak('d3', 800)
  await next(); await sleep(1500)

  // 2. Recommandations
  await speak('r1')
  await point(page.locator('main table tbody tr').first())
  await speak('r2')
  await point(page.locator('main table tbody tr').nth(1))
  await speak('r3', 800)
  await next(); await sleep(2000)

  // 3. Fiche d'Olivier Gauthier (la visite l'ouvre directement)
  const drawer = page.locator('[role=dialog]').filter({ hasText: 'Pourquoi ce donateur' })
  await speak('f1')
  await point(drawer.getByText(/Risque d'arrêter son don mensuel/).first())
  await speak('f2')
  await point(drawer.getByText(/Dons espérés sur un an/).first())
  await speak('f2b')
  await point(drawer.getByText(/Dernier don il y a/).first())
  await speak('f3')
  await smoothTo(drawer.getByText('Historique sur 24 mois').first(), 'start')
  await sleep(1000)
  const chart = drawer.locator('.recharts-wrapper').first()
  const cb = await chart.boundingBox()
  if (cb) await moveTo(cb.x + cb.width * 0.93, cb.y + cb.height * 0.45, 35)
  await speak('f4', 600)
  await smoothTo(drawer.getByText(/Risque d'arrêter son don mensuel/).first(), 'center')
  await sleep(900)
  await point(drawer.getByRole('button', { name: /Préparer le courriel/ }))
  await speak('f5', 800)
  await next(); await sleep(2200)

  // 4. Impact : curseur 300 -> 100
  await page.locator('#capacite').evaluate((el) => window.scrollBy({ top: el.getBoundingClientRect().top - 130, behavior: 'smooth' }))
  await sleep(1000)
  const range = page.locator('#capacite input[type=range]')
  await point(page.getByText(/Avec les mêmes 300 contacts/).locator('visible=true').first())
  await speak('i1')
  await point(page.getByText(/seul\s*:\s*3,1\sfois/).locator('visible=true').first())
  await speak('i2', 400)
  await point(page.getByText(/soit 3,0 fois plus/).locator('visible=true').first())
  await speak('i3', 500)
  {
    const rb = await range.boundingBox()
    const xOf = (v) => rb.x + 8 + ((v - 25) / (1500 - 25)) * (rb.width - 16)
    await moveTo(xOf(300), rb.y + rb.height / 2, 30)
    await page.mouse.down()
    await page.mouse.move(xOf(100), rb.y + rb.height / 2, { steps: 45 })
    await page.mouse.up()
    if ((await range.inputValue()) !== '100') await range.fill('100')
  }
  await sleep(700)
  await point(page.getByText(/seul\s*:\s*6,1\sfois/).locator('visible=true').first())
  await speak('i4'); await speak('i5')
  await point(page.getByText(/Effet de l'action/).first())
  await speak('i6'); await speak('i7', 800)
  await next(); await sleep(1800)

  // 5. Modèle IA : onglets
  await speak('m1')
  await point(page.getByRole('tab', { name: "Risque d'arrêt" }))
  await speak('m2')
  await point(page.getByText(/Parmi les 50 premiers noms/).first())
  await speak('m2b', 500)
  await click(page.getByRole('tab', { name: 'Hausse du don' }))
  await sleep(500)
  await point(page.getByText(/ne remplit pas nos deux conditions/).first())
  await speak('m3', 500)
  await click(page.getByRole('tab', { name: /Données réelles/ }))
  await sleep(600)
  await scrollBy(330)
  await sleep(1000)
  await point(page.getByText(/18\s824 envois/).locator('visible=true').first())
  await speak('m4')
  await point(page.getByText(/reste donc à l'essai/).first())
  await speak('m5', 800)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(700)
  await next(); await sleep(2200)

  // 6. Courriels
  await speak('c1')
  await point(page.getByText(/carte expirée/).first())
  await speak('c2')
  const approve = page.getByRole('button', { name: /^Approuver$/ }).last()
  await point(approve)
  await speak('c3', 300)
  await click(approve)
  await sleep(800)
  await point(page.getByText(/Mis de côté pour mesurer/).first())
  await speak('c4', 800)
  await next(); await sleep(1200)

  // 7. Équité (après la visite)
  await click(page.getByRole('link', { name: /Modèle IA/ }).first())
  await sleep(1000)
  await speak('e1', 200)
  await click(page.getByRole('tab', { name: 'Passage au mensuel' }))
  await sleep(500)
  const det = page.locator('summary', { hasText: 'Voir le détail technique' }).first()
  await click(det)
  await sleep(100)
  const eq = page.getByText('Équité par sous-groupe').first()
  await eq.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -20))
  await sleep(1200)
  await point(page.locator('tr', { hasText: '70 ans et plus' }).first())
  await speak('e2')
  await point(page.locator('tr', { hasText: '35 à 54 ans' }).first())
  await speak('e3', 100); await speak('e4')
  await speak('e5', 600)

  // 8. Conclusion
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await click(page.getByRole('link', { name: /Tableau de bord/ }).first())
  await sleep(800)
  await speak('z1', 1200)

  await cdp.send('Page.stopScreencast')
  const recEnd = now()
  await sleep(500)
  await ctx.close()

  // ---------- 5. Montage ----------
  const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${((frames[i + 1]?.t ?? recEnd) - fr.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).f}'\n`
  writeFileSync(join(WORK, 'frames.txt'), list)
  const offset = TITLE_S - frames[0].t // temps de la vidéo finale = temps d'enregistrement + offset
  const total = TITLE_S + (recEnd - frames[0].t) + END_S

  const srt = (s) => { const ms = Math.round(s * 1000); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}` }
  writeFileSync(join(OUT_DIR, 'narration.srt'), cues.map((c, i) => `${i + 1}\n${srt(c.start + offset)} --> ${srt(c.end + offset)}\n${LINES[c.id].sub}\n`).join('\n'))

  const args = ['-y', '-loglevel', 'error',
    '-loop', '1', '-t', String(TITLE_S), '-i', join(WORK, 'title.png'),
    '-f', 'concat', '-safe', '0', '-i', join(WORK, 'frames.txt'),
    '-loop', '1', '-t', String(END_S), '-i', join(WORK, 'end.png')]
  cues.forEach((c) => args.push('-i', LINES[c.id].wav))
  const v = (i, extra = '') => `[${i}:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,setsar=1${extra}[v${i}]`
  let fc = `${v(0, `,fade=t=in:st=0:d=0.5,fade=t=out:st=${TITLE_S - 0.4}:d=0.4`)};${v(1)};${v(2, ',fade=t=in:st=0:d=0.5')};[v0][v1][v2]concat=n=3:v=1:a=0[v]`
  cues.forEach((c, k) => { const ms = Math.round((c.start + offset) * 1000); fc += `;[${k + 3}:a]adelay=${ms}:all=1[a${k}]` })
  fc += `;${cues.map((_, k) => `[a${k}]`).join('')}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[a]`
  args.push('-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-tune', 'stillimage',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', total.toFixed(3), join(OUT_DIR, 'Demo-Fidelia.mp4'))
  sh('ffmpeg', args)
  console.log(`frames : ${frames.length}, durée ≈ ${total.toFixed(1)} s → docs/video/Demo-Fidelia.mp4, docs/video/narration.srt`)
} finally {
  await browser.close()
  server?.kill()
}
