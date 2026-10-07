import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Database, FlaskConical, HandCoins, Info, Scale, ShieldCheck, Users } from 'lucide-react'
import { Card, PageHeader, Stat, Tabs } from '../components/ui.tsx'
import { formatMoney, fx } from '../lib/dates.ts'
import { DEFAULT_EFFECT, simulate, valueAtStake } from '../lib/impact.ts'
import { MODEL_COLOR } from '../lib/labels.ts'
import type { ModelKind } from '../lib/types.ts'
import { MODEL_KINDS, MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'
import kdd from '../data/kdd98.json'

const tooltipStyle = { borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }
const axis = { tick: { fontSize: 11, fill: '#a8a29e' } }
const KIND_SHORT: Record<ModelKind, string> = { churn: 'Attrition évitée', upgrade: 'Hausses', conversion: 'Passages au mensuel', reactivation: 'Réactivations' }

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
    { name: 'Règle RFM', value: totals.rfm, color: '#a8a29e' },
    { name: 'Modèle Fidélia', value: totals.model, color: '#1f7a4d' },
  ]
  const byKind = lines.map((l) => ({ name: KIND_SHORT[l.kind], Hasard: Math.round(l.random), RFM: Math.round(l.rfm), Modèle: Math.round(l.model) }))

  const r = reports[curveKind]
  const curves = useMemo(() => {
    if (!r) return []
    const sel = r.evaluations.find((e) => e.algorithm === r.deployed)
    const rfm = r.evaluations.find((e) => e.algorithm === 'rfm')
    const src = sel?.valueGain ?? sel?.gain ?? []
    return src.map((p, i) => ({ x: Math.round(p.x * 100), Modèle: p.y, RFM: (rfm?.valueGain ?? rfm?.gain)?.[i]?.y, Hasard: p.x }))
  }, [r])
  const at10 = curves.find((c) => c.x >= 10)
  const profit = (kdd as unknown as { reactivation: { profit: { modelTop20: { net: number }; rfmTop20: { net: number } } } }).reactivation.profit

  return (
    <>
      <PageHeader
        title="Impact"
        subtitle="Ce que l'association pourrait récupérer avec une campagne ciblée par le modèle, comparé à la règle RFM et au hasard, à effort égal."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stakes.map((s) => (
          <Stat
            key={s.kind}
            label={s.kind === 'churn' ? 'Dons mensuels à risque' : s.kind === 'upgrade' ? 'Potentiel de hausse' : s.kind === 'conversion' ? 'Potentiel de conversion' : 'Potentiel de réactivation'}
            value={formatMoney(s.atStake)}
            hint={`par an · ${s.population.toLocaleString('fr-CA')} donateurs concernés`}
            tone={s.kind === 'churn' ? 'bad' : 'good'}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">Valeur en jeu = somme, sur les donateurs actuels, de la probabilité prédite × la valeur annuelle du cas (don mensuel perdu, hausse, nouveau mensuel, don de retour).</p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="Paramètres de la campagne" subtitle="Hypothèses modifiables">
          <div className="space-y-6 p-5">
            <label className="block">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-stone-800"><Users className="size-4 text-stone-400" />Donateurs contactés</span>
                <span className="tabular-nums text-stone-900">{capacity}</span>
              </div>
              <input type="range" min={25} max={1500} step={25} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="mt-1.5 w-full accent-brand-600" />
              <p className="text-xs text-stone-400">Capacité de l'équipe pour une campagne (courriels relus, appels).</p>
            </label>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-stone-800"><FlaskConical className="size-4 text-stone-400" />Effet de l'action (hypothèse)</p>
              <p className="mb-3 text-xs text-stone-400">Part des cas visés que la sollicitation change réellement. À mesurer avec le groupe témoin.</p>
              {MODEL_KINDS.map((k) => (
                <label key={k} className="mb-3 block">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-stone-600">{MODEL_SPECS[k].action}</span>
                    <span className="tabular-nums text-stone-900">{Math.round(effect[k] * 100)} %</span>
                  </div>
                  <input type="range" min={0.05} max={0.6} step={0.05} value={effect[k]} onChange={(e) => setEffect({ ...effect, [k]: Number(e.target.value) })} className="w-full" style={{ accentColor: MODEL_COLOR[k] }} />
                </label>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Dons récupérés estimés par an" subtitle={`Pour ${capacity} donateurs contactés, répartis selon la valeur en jeu de chaque cas d'usage`}>
            {training || !lines.length ? (
              <p className="px-5 py-16 text-center text-sm text-stone-500">Calcul en cours…</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
                <div>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={bars} margin={{ left: 0, right: 8, top: 16 }}>
                        <CartesianGrid vertical={false} stroke="#f0eeec" />
                        <XAxis dataKey="name" {...axis} tickLine={false} axisLine={false} />
                        <YAxis {...axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} k$`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#44403c', formatter: (v: unknown) => formatMoney(Number(v)) }}>
                          {bars.map((b) => <Cell key={b.name} fill={b.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <div className="rounded-2xl bg-brand-900 p-5 text-white">
                    <p className="text-sm text-brand-100/80">Gain du modèle par rapport à la règle RFM</p>
                    <p className="mt-1 font-display text-4xl font-semibold tabular-nums">+{formatMoney(totals.model - totals.rfm)}</p>
                    <p className="mt-1 text-sm text-brand-100/80">par an, soit ×{fx((totals.model / Math.max(totals.rfm, 1)), 1)} à effort égal</p>
                  </div>
                  <p className="text-xs text-stone-500">
                    Calcul : valeur en jeu × part captée en contactant ce volume (courbe mesurée sur le jeu de test) × effet de l'action. Seul l'effet est une hypothèse ; le ciblage est mesuré.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card title="Détail par cas d'usage" subtitle="Dons récupérés estimés par an, à effort égal">
            <div className="h-64 p-4">
              <ResponsiveContainer>
                <BarChart data={byKind} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f0eeec" />
                  <XAxis dataKey="name" {...axis} tickLine={false} axisLine={false} />
                  <YAxis {...axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} k$`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Hasard" fill="#d6d3d1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="RFM" fill="#a8a29e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Modèle" fill="#1f7a4d" radius={[4, 4, 0, 0]} />
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
        <Card title="Part de la valeur captée selon l'effort" subtitle="Mesurée sur des donateurs jamais vus (jeu de test)" action={
          <Tabs<ModelKind> value={curveKind} onChange={setCurveKind} items={MODEL_KINDS.map((k) => ({ value: k, label: MODEL_SPECS[k].action }))} />
        }>
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <LineChart data={curves} margin={{ left: 0, right: 12, top: 8, bottom: 12 }}>
                <CartesianGrid stroke="#f0eeec" />
                <XAxis dataKey="x" {...axis} unit="%" label={{ value: 'Part des donateurs contactés', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#78716c' }} />
                <YAxis {...axis} width={44} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v) * 100)} %`} labelFormatter={(v) => `${v} % contactés`} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line dataKey="Hasard" stroke="#d6d3d1" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line dataKey="RFM" stroke="#a8a29e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="Modèle" stroke="#1f7a4d" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {at10 && (
            <p className="border-t border-stone-100 px-5 py-3 text-sm text-stone-600">
              En contactant <b>10 %</b> des donateurs concernés, le modèle capte <b>{Math.round(at10.Modèle * 100)} %</b> de la valeur, contre {Math.round((at10.RFM ?? 0) * 100)} % pour la règle RFM et 10 % au hasard.
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
                  Sur {kdd.n.toLocaleString('fr-CA')} donateurs réels (KDD Cup 1998), avec un budget limité à 20 % des envois, le ciblage par le modèle rapporte{' '}
                  <b>{formatMoney(profit.modelTop20.net)}</b> de profit net contre {formatMoney(profit.rfmTop20.net)} avec la règle RFM, soit <b>+{Math.round((profit.modelTop20.net / profit.rfmTop20.net - 1) * 100)} %</b>.
                </p>
                <Link to="/modele" className="mt-2 inline-block font-medium text-brand-600">Voir la validation complète</Link>
              </div>
            </div>
          </Card>
          <Card>
            <ul className="divide-y divide-stone-100 text-sm">
              <li className="flex gap-3 p-5"><Scale className="mt-0.5 size-5 shrink-0 text-amber-600" /><p className="text-stone-600"><b className="text-stone-900">Prédire n'est pas causer.</b> Un donateur qui allait passer au mensuel de toute façon n'est pas un gain. C'est pourquoi l'effet est une hypothèse distincte, à mesurer.</p></li>
              <li className="flex gap-3 p-5"><FlaskConical className="mt-0.5 size-5 shrink-0 text-brand-600" /><p className="text-stone-600"><b className="text-stone-900">Groupe témoin.</b> Chaque cycle d'automatisation garde 10 % des donateurs ciblés sans contact. L'écart de dons entre contactés et témoins mesure l'effet réel des actions.</p></li>
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
