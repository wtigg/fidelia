import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Database, FlaskConical, HandCoins, Info, Lightbulb, Scale, ShieldCheck, Users } from 'lucide-react'
import { Card, PageHeader, Stat } from '../components/ui.tsx'
import { TechDetails, WrapTabs } from '../components/plain/TechDetails.tsx'
import { Term } from '../components/plain/Term.tsx'
import { formatMoney, fx } from '../lib/dates.ts'
import { DEFAULT_EFFECT, simulate, valueAtStake } from '../lib/impact.ts'
import { MODEL_COLOR } from '../lib/labels.ts'
import type { ModelKind } from '../lib/types.ts'
import { MODEL_KINDS, MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'
import kdd from '../data/kdd98.json'

const tooltipStyle = { borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }
const axis = { tick: { fontSize: 11, fill: '#a8a29e' } }
const kTick = (v: number) => `${(v / 1000).toLocaleString('fr-CA', { maximumFractionDigits: v < 10000 ? 1 : 0 })} k$`

/** Étiquette d'axe sur deux lignes au plus : évite que les noms longs se chevauchent (surtout sur téléphone). */
function WrapTick({ x, y, payload, width = 360, visibleTicksCount = 4 }: { x?: number; y?: number; payload?: { value: string }; width?: number; visibleTicksCount?: number }) {
  const words = String(payload?.value ?? '').split(' ')
  // place disponible par étiquette ≈ largeur de l'axe / nombre d'étiquettes ; ~6 px par caractère à 11 px
  const max = Math.max(6, Math.floor(width / Math.max(visibleTicksCount, 1) / 6.2))
  const lines: string[] = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last + ' ' + w).length <= max) lines[lines.length - 1] = last + ' ' + w
    else lines.push(w)
  }
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={11} fill="#78716c">
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 10 : 13}>{l}</tspan>)}
    </text>
  )
}

export default function Impact() {
  const { scores, reports, training } = useStore()
  const [capacity, setCapacity] = useState(300)
  const [effect, setEffect] = useState<Record<ModelKind, number>>(DEFAULT_EFFECT)
  const [curveKind, setCurveKind] = useState<ModelKind>('churn')

  const stakes = useMemo(() => MODEL_KINDS.map((k) => ({ kind: k, ...valueAtStake(scores, k) })), [scores])
  const lines = useMemo(() => (Object.keys(reports).length ? simulate(scores, reports, capacity, effect) : []), [scores, reports, capacity, effect])
  const total = (key: 'model' | 'rfm' | 'random') => lines.reduce((s, l) => s + l[key], 0)
  const totals = { model: total('model'), rfm: total('rfm'), random: total('random') }
  const bars = [
    { name: 'Au hasard', value: totals.random, color: '#d6d3d1' },
    { name: 'Méthode habituelle', value: totals.rfm, color: '#a8a29e' },
    { name: 'Fidélia', value: totals.model, color: '#1f7a4d' },
  ]
  const byKind = lines.map((l) => ({ name: MODEL_SPECS[l.kind].action, 'Au hasard': Math.round(l.random), 'Méthode habituelle': Math.round(l.rfm), Fidélia: Math.round(l.model) }))

  const r = reports[curveKind]
  const curves = useMemo(() => {
    if (!r) return []
    const sel = r.evaluations.find((e) => e.algorithm === r.deployed)
    const rfm = r.evaluations.find((e) => e.algorithm === 'rfm')
    const src = sel?.valueGain ?? sel?.gain ?? []
    return src.map((p, i) => ({ x: Math.round(p.x * 100), Fidélia: p.y, 'Méthode habituelle': (rfm?.valueGain ?? rfm?.gain)?.[i]?.y, 'Au hasard': p.x }))
  }, [r])
  const at10 = curves.find((c) => c.x >= 10)
  type KddReac = { baseRate: number; selected: string; evaluations: { algorithm: string; ap: number; apDiffVsRfmCI?: [number, number] }[]; profit: { nTest: number; modelTop20: { net: number }; rfmTop20: { net: number } } }
  const reac = (kdd as unknown as { reactivation: KddReac }).reactivation
  const profit = reac.profit
  const reacSel = reac.evaluations.find((e) => e.algorithm === reac.selected)
  const reacReady = !!reacSel && reacSel.ap >= 2 * reac.baseRate && (reacSel.apDiffVsRfmCI?.[0] ?? -1) > 0

  return (
    <>
      <PageHeader
        title="Impact"
        subtitle={<>Ce que votre organisme pourrait récupérer en contactant les bons donateurs, comparé à la <Term k="methode">méthode habituelle</Term> et au hasard, avec le même effort.</>}
      />

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb className="size-4" />Pourquoi Fidélia</p>
        <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <li>
            <p className="font-display text-3xl font-semibold text-stone-900">53 %</p>
            <p className="mt-1 text-sm text-stone-700">des OBNL canadiens de moins de 1 M$ confient la technologie et les données à des employés sans formation dans ce domaine.</p>
            <p className="mt-1 text-xs text-stone-500">CanadaHelps, 2024</p>
          </li>
          <li>
            <p className="font-display text-3xl font-semibold text-stone-900">92 %</p>
            <p className="mt-1 text-sm text-stone-700">des OBNL utilisent déjà l'IA, surtout pour écrire, rarement pour cibler.</p>
            <p className="mt-1 text-xs text-stone-500">Virtuous et Fundraising.AI, 2026</p>
          </li>
          <li>
            <p className="font-display text-3xl font-semibold text-stone-900">43,3 %</p>
            <p className="mt-1 text-sm text-stone-700">des donateurs seulement redonnent l'année suivante.</p>
            <p className="mt-1 text-xs text-stone-500">FEP, 2025</p>
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stakes.map((s) => (
          <Stat
            key={s.kind}
            label={s.kind === 'churn' ? 'Dons mensuels à risque' : s.kind === 'upgrade' ? 'Potentiel de hausse' : s.kind === 'conversion' ? 'Potentiel du passage au mensuel' : 'Potentiel de réactivation'}
            value={<span data-check={`stake-${s.kind}`} data-value={s.atStake}>{formatMoney(s.atStake)}</span>}
            hint={`par an · ${s.population.toLocaleString('fr-CA')} donateurs concernés`}
            tone={s.kind === 'churn' ? 'bad' : 'good'}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">Montants <Term k="valeurEnJeu">en jeu</Term> sur un an, pour vos donateurs actuels.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="Paramètres de la campagne" subtitle="Hypothèses modifiables">
          <div className="space-y-6 p-5">
            <label id="capacite" className="block scroll-mt-24">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-stone-800"><Users className="size-4 text-stone-400" />Donateurs contactés</span>
                <span className="tabular-nums text-stone-900">{capacity}</span>
              </div>
              <input type="range" min={25} max={1500} step={25} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="mt-1.5 w-full" />
              <p className="text-xs text-stone-400">Capacité de l'équipe pour une campagne (courriels relus, appels).</p>
            </label>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-stone-800"><FlaskConical className="size-4 text-stone-400" /><Term k="effet">Effet de l'action</Term> (hypothèse)</p>
              <p className="mb-3 text-xs text-stone-400">Sur 100 donateurs contactés, combien changent vraiment d'avis grâce au message. À mesurer avec les <Term k="temoin">donateurs mis de côté</Term>.</p>
              {MODEL_KINDS.map((k) => (
                <label key={k} className="mb-3 block">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-600">{MODEL_SPECS[k].action}</span>
                    <span className="tabular-nums text-stone-900">{Math.round(effect[k] * 100)} %</span>
                  </div>
                  <input type="range" min={0.05} max={0.6} step={0.05} value={effect[k]} onChange={(e) => setEffect({ ...effect, [k]: Number(e.target.value) })} className="w-full" style={{ '--range': MODEL_COLOR[k] } as CSSProperties} />
                </label>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Dons récupérés estimés par an" subtitle={`Pour ${capacity} donateurs contactés, répartis entre les quatre actions selon les dons en jeu`}>
            {training || !lines.length ? (
              <p className="px-5 py-16 text-center text-sm text-stone-500">Calcul en cours…</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
                <div>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={bars} margin={{ left: 0, right: 8, top: 16 }}>
                        <CartesianGrid vertical={false} stroke="#f0eeec" />
                        <XAxis dataKey="name" interval={0} tickLine={false} axisLine={false} height={44} tick={<WrapTick />} />
                        <YAxis {...axis} tickLine={false} axisLine={false} width={56} tickFormatter={kTick} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                        <Bar dataKey="value" isAnimationActive={false} radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#44403c', formatter: (v: unknown) => formatMoney(Number(v)) }}>
                          {bars.map((b) => <Cell key={b.name} fill={b.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <div className="rounded-2xl bg-brand-900 p-5 text-white">
                    <p className="text-sm text-brand-100/80">Avec les mêmes {capacity} contacts, Fidélia récupère</p>
                    <p className="mt-1 font-display text-4xl font-semibold tabular-nums" data-check="gain" data-capacity={capacity} data-model={totals.model} data-rfm={totals.rfm}>+{formatMoney(totals.model - totals.rfm)}</p>
                    <p className="mt-1 text-sm text-brand-100/80">de plus par an que la méthode habituelle, soit {fx((totals.model / Math.max(totals.rfm, 1)), 1)} fois plus.</p>
                  </div>
                  <TechDetails>
                    <p className="text-xs text-stone-500">
                      Calcul : valeur en jeu × part captée en contactant ce volume (courbe de gain mesurée sur le jeu de test) × effet de l'action. Valeur en jeu = somme, sur les donateurs actuels, de la probabilité prédite × la valeur annuelle du cas (don mensuel perdu, hausse, nouveau mensuel, don de retour). Seul l'effet est une hypothèse ; le ciblage est mesuré. « Méthode habituelle » = règle RFM (récence, fréquence, montant).
                    </p>
                  </TechDetails>
                </div>
              </div>
            )}
          </Card>

          <Card title="Détail par action" subtitle="Dons récupérés estimés par an, à effort égal">
            <div className="h-64 p-4">
              <ResponsiveContainer>
                <BarChart data={byKind} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f0eeec" />
                  <XAxis dataKey="name" interval={0} tickLine={false} axisLine={false} height={44} tick={<WrapTick />} />
                  <YAxis {...axis} tickLine={false} axisLine={false} width={56} tickFormatter={kTick} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="Au hasard" fill="#d6d3d1" radius={[4, 4, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="Méthode habituelle" fill="#a8a29e" radius={[4, 4, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="Fidélia" fill="#1f7a4d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-px border-t border-stone-100 bg-stone-100 text-sm lg:grid-cols-4">
              {lines.map((l) => (
                <li key={l.kind} className="bg-white px-4 py-3">
                  <p className="text-xs text-stone-500">{MODEL_SPECS[l.kind].action}</p>
                  <p className="font-medium tabular-nums text-stone-900">{l.contacted} contactés / {l.population.toLocaleString('fr-CA')}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Part de la valeur captée selon l'effort" subtitle={<>Mesurée sur des <Term k="jamaisVus">donateurs jamais vus</Term></>}>
          <div className="px-5 pt-4">
            <WrapTabs<ModelKind> value={curveKind} onChange={setCurveKind} items={MODEL_KINDS.map((k) => ({ value: k, label: MODEL_SPECS[k].action }))} />
          </div>
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <LineChart data={curves} margin={{ left: 0, right: 12, top: 8, bottom: 12 }}>
                <CartesianGrid stroke="#f0eeec" />
                <XAxis dataKey="x" {...axis} unit="%" label={{ value: 'Part des donateurs contactés', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#78716c' }} />
                <YAxis {...axis} width={44} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v) * 100)} %`} labelFormatter={(v) => `${v} % contactés`} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line dataKey="Au hasard" stroke="#d6d3d1" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line dataKey="Méthode habituelle" stroke="#a8a29e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="Fidélia" stroke="#1f7a4d" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {at10 && (
            <p className="border-t border-stone-100 px-5 py-3 text-sm text-stone-600">
              En contactant <b>10 %</b> des donateurs concernés, Fidélia capte <b>{Math.round(at10.Fidélia * 100)} %</b> de la valeur, contre {Math.round((at10['Méthode habituelle'] ?? 0) * 100)} % pour la méthode habituelle et 10 % au hasard.
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex gap-4 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-600 text-white"><Database className="size-5" /></span>
              <div className="text-sm text-stone-600">
                <p className="font-semibold text-stone-900">Vérifié sur de vrais donateurs</p>
                <p className="mt-1">
                  Sur {profit.nTest.toLocaleString('fr-CA')} donateurs réels de test (tirés de {kdd.n.toLocaleString('fr-CA')}, KDD Cup 1998), avec un budget limité à 20 % des envois, le ciblage par le modèle rapporte{' '}
                  <b>{formatMoney(profit.modelTop20.net)}</b> de profit net contre {formatMoney(profit.rfmTop20.net)} avec la méthode habituelle, soit <b>+{Math.round((profit.modelTop20.net / profit.rfmTop20.net - 1) * 100)} %</b>.
                  {' '}{reacReady ? 'Ce modèle de réactivation remplit nos deux conditions.' : <>Ce modèle de réactivation ne remplit pas encore <Term k="conditions">nos deux conditions pour utiliser le modèle</Term> : la méthode est validée, pas un modèle prêt à l'emploi.</>}
                </p>
                <Link to="/modele" className="mt-2 inline-block font-medium text-brand-600">Voir la validation complète</Link>
              </div>
            </div>
          </Card>
          <Card>
            <ul className="divide-y divide-stone-100 text-sm">
              <li className="flex gap-3 p-5"><Scale className="mt-0.5 size-5 shrink-0 text-amber-600" /><p className="text-stone-600"><b className="text-stone-900">Prédire n'est pas causer.</b> Un donateur qui allait passer au mensuel de toute façon n'est pas un gain. C'est pourquoi l'effet est une hypothèse distincte, à mesurer.</p></li>
              <li className="flex gap-3 p-5"><FlaskConical className="mt-0.5 size-5 shrink-0 text-brand-600" /><p className="text-stone-600"><b className="text-stone-900">Mis de côté pour mesurer (10 %).</b> Chaque cycle d'automatisation garde 10 % des donateurs ciblés sans contact (<Term k="temoin">groupe témoin</Term>). L'écart de dons entre contactés et mis de côté mesure l'effet réel des actions.</p></li>
              <li className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-700" /><p className="text-stone-600"><b className="text-stone-900">Pas de sur-sollicitation.</b> Plafond d'un courriel par donateur tous les 30 jours, et remerciement avant toute nouvelle demande.</p></li>
              <li className="flex gap-3 p-5"><HandCoins className="mt-0.5 size-5 shrink-0 text-stone-500" /><p className="text-stone-600"><b className="text-stone-900">Temps de l'équipe.</b> Sans outil, trier {scores.length.toLocaleString('fr-CA')} donateurs à la main est impossible pour une équipe de 1 à 5 personnes. Fidélia livre une liste priorisée avec un brouillon par donateur.</p></li>
              <li className="flex gap-3 p-5"><Info className="mt-0.5 size-5 shrink-0 text-stone-400" /><p className="text-stone-500">Données de démonstration synthétiques : les montants illustrent la méthode, pas un résultat réel d'association.</p></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
