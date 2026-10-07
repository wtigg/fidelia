import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, HandCoins, Repeat, Sparkles, TrendingUp, Users } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { Badge, Card, PageHeader, ProbBar, Stat } from '../components/ui.tsx'
import { addMonths, formatMoney, monthIndex, fx } from '../lib/dates.ts'
import { DEFAULT_EFFECT, simulate, valueAtStake } from '../lib/impact.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS, ACTION_TONE, ACTION_TYPES, SEGMENT_LABELS } from '../lib/labels.ts'
import { REQUIREMENTS } from '../lib/requirements.ts'
import type { Segment } from '../lib/types.ts'
import { MODEL_KINDS, MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'

const monthFmt = new Intl.DateTimeFormat('fr-CA', { month: 'short', timeZone: 'UTC' })
const SEG_COLOR: Record<Segment, string> = { monthly: '#1f7a4d', annual: '#0284c7', one_time: '#f4c95d', lapsed: '#d6d3d1' }

export default function Dashboard() {
  const { dataset, scores, donorsById, reports, training, trainingStep } = useStore()
  const [open, setOpen] = useState<string | null>(null)

  const kpi = useMemo(() => {
    const monthly = scores.filter((s) => s.segment === 'monthly')
    const mrr = monthly.reduce((s, x) => s + (donorsById.get(x.donorId)?.monthlyAmount ?? 0), 0)
    const atRisk = valueAtStake(scores, 'churn').atStake
    const actions = scores.filter((s) => s.action)
    const active = scores.filter((s) => s.segment !== 'lapsed').length
    const recovered = Object.keys(reports).length ? simulate(scores, reports, 300, DEFAULT_EFFECT) : []
    return {
      monthly: monthly.length,
      mrr,
      atRisk,
      actions: actions.length,
      active,
      recoverable: recovered.reduce((s, l) => s + l.model, 0),
      vsRfm: recovered.reduce((s, l) => s + l.model - l.rfm, 0),
    }
  }, [scores, donorsById, reports])

  const series = useMemo(() => {
    const start = new Date(dataset.historyStart)
    const months = monthIndex(new Date(dataset.refDate), start)
    const rows = Array.from({ length: months }, (_, m) => ({ label: monthFmt.format(addMonths(start, m)), monthly: 0, one_time: 0, annual: 0 }))
    for (const g of dataset.donations) {
      if (g.status !== 'paid') continue
      const m = monthIndex(new Date(g.date), start)
      if (m >= 0 && m < months) rows[m][g.kind] += g.amount
    }
    return rows.slice(-24)
  }, [dataset])

  const segments = useMemo(
    () => (['monthly', 'annual', 'one_time', 'lapsed'] as Segment[]).map((s) => ({ name: SEGMENT_LABELS[s], seg: s, value: scores.filter((x) => x.segment === s).length })),
    [scores],
  )

  const byAction = useMemo(
    () =>
      ACTION_TYPES.map((type) => {
        const list = scores.filter((s) => s.action === type)
        return { type, count: list.length, value: list.reduce((s, x) => s + x.expectedValue, 0) }
      }),
    [scores],
  )

  const top = scores.filter((s) => s.action && s.action !== 'thank').slice(0, 6)
  const checks = MODEL_KINDS.flatMap((k) => (reports[k] ? REQUIREMENTS.map((r) => r.check(reports[k]!).ok) : []))

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={
          training
            ? `Le modèle analyse vos donateurs… ${trainingStep ? `(${MODEL_SPECS[trainingStep].title})` : ''}`
            : `${dataset.donors.length.toLocaleString('fr-CA')} donateurs analysés. ${kpi.actions} actions recommandées aujourd'hui.`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Donateurs actifs" value={kpi.active.toLocaleString('fr-CA')} hint={`dont ${kpi.monthly} mensuels`} icon={<Users className="size-4" />} />
        <Stat label="Dons mensuels récurrents" value={formatMoney(kpi.mrr)} hint={`soit ${formatMoney(kpi.mrr * 12)} par an`} icon={<Repeat className="size-4" />} tone="good" />
        <Stat label="Dons mensuels à risque" value={formatMoney(kpi.atRisk)} hint="par an, pondéré par le risque d'attrition" icon={<AlertTriangle className="size-4" />} tone="bad" />
        <Link to="/impact" className="block transition-transform hover:-translate-y-0.5">
          <Stat label="Récupérable (300 contacts)" value={formatMoney(kpi.recoverable)} hint={<span className="text-brand-700">+{formatMoney(kpi.vsRfm)} par rapport à la règle RFM →</span>} icon={<HandCoins className="size-4" />} tone="gold" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Dons collectés" subtitle="24 derniers mois, par type de don. Pic de décembre : période des fêtes et reçus fiscaux.">
          <div className="h-72 px-2 py-4">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 4, right: 12, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#f0eeec" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} k$`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v, n) => [formatMoney(Number(v)), n === 'monthly' ? 'Mensuel' : n === 'annual' ? 'Annuel' : 'Ponctuel']} />
                <Area type="monotone" dataKey="monthly" stackId="1" stroke="#1f7a4d" fill="#1f7a4d" fillOpacity={0.85} />
                <Area type="monotone" dataKey="annual" stackId="1" stroke="#0284c7" fill="#0284c7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="one_time" stackId="1" stroke="#f4c95d" fill="#f4c95d" fillOpacity={0.8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Base de donateurs" subtitle="Segments à la date d'analyse">
          <div className="flex items-center gap-4 p-5">
            <div className="size-36 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={segments} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={2} stroke="none">
                    {segments.map((s) => <Cell key={s.seg} fill={SEG_COLOR[s.seg]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.seg} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-stone-600"><i className="size-2.5 rounded-full" style={{ background: SEG_COLOR[s.seg] }} />{s.name}</span>
                  <span className="font-medium tabular-nums text-stone-900">{s.value.toLocaleString('fr-CA')}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
            Les inactifs sont la majorité : moins d'un donateur sur deux redonne l'année suivante, c'est le problème que Fidélia attaque.
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Priorités du jour" subtitle="Où une action rapporte le plus : probabilité × valeur annuelle" action={<Link to="/recommandations" className="text-sm font-medium text-brand-600 hover:text-brand-700">Tout voir</Link>}>
          <ul className="divide-y divide-stone-100">
            {top.map((s) => {
              const d = donorsById.get(s.donorId)!
              return (
                <li key={s.donorId}>
                  <button onClick={() => setOpen(s.donorId)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-stone-50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">{d.firstName[0]}{d.lastName[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{d.firstName} {d.lastName}</p>
                      <p className="truncate text-xs text-stone-500">{s.reasons.map((r) => r.text).join(' · ')}</p>
                    </div>
                    <Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge>
                    <div className="hidden sm:block"><ProbBar value={s.actionProb} color={ACTION_COLOR[s.action!]} width="w-16" /></div>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums text-stone-900">{formatMoney(s.expectedValue)}</span>
                  </button>
                </li>
              )
            })}
            {!top.length && <li className="px-5 py-10 text-center text-sm text-stone-500">{training ? 'Calcul en cours…' : 'Aucune action au-dessus des seuils.'}</li>}
          </ul>
        </Card>

        <Card title="Actions recommandées" subtitle="Les quatre listes de la semaine" action={<Link to="/automatisations" className="text-sm font-medium text-brand-600 hover:text-brand-700">Seuils</Link>}>
          <ul className="divide-y divide-stone-100">
            {byAction.map(({ type, count, value }) => (
              <li key={type}>
                <Link to={`/recommandations?type=${type}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                  <span className="h-8 w-1 rounded-full" style={{ background: ACTION_COLOR[type] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900">{ACTION_LABELS[type]}</p>
                    <p className="truncate text-xs text-stone-500">{ACTION_DESCRIPTIONS[type]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">{count}</p>
                    <p className="text-xs tabular-nums text-stone-500">{type === 'thank' ? '—' : formatMoney(value)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6" title="Santé des modèles" subtitle="AUC-PR sur des donateurs jamais vus, comparée à la règle RFM (méthode traditionnelle)" action={
        <Link to="/modele" className="flex items-center gap-1.5 text-sm font-medium text-brand-600"><CheckCircle2 className="size-4" />{checks.filter(Boolean).length}/{checks.length} requis validés</Link>
      }>
        <div className="grid grid-cols-1 gap-px bg-stone-100 sm:grid-cols-2 xl:grid-cols-4">
          {MODEL_KINDS.map((k) => {
            const r = reports[k]
            const ev = r?.evaluations.find((e) => e.algorithm === r.selected)
            const rfm = r?.evaluations.find((e) => e.algorithm === 'rfm')
            const max = Math.max(ev?.ap ?? 0, rfm?.ap ?? 0, 0.01)
            return (
              <div key={k} className="bg-white p-5">
                <p className="text-sm font-medium text-stone-800">{MODEL_SPECS[k].title}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{ev ? `×${fx((ev.ap / Math.max(rfm?.ap ?? 1, 1e-6)), 1)}` : '—'}</p>
                <p className="text-xs text-stone-500">{r?.deployed === 'rfm' ? 'ne bat pas RFM : règle RFM utilisée' : 'vs règle RFM · modèle déployé'}</p>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><span className="w-12 text-stone-500">Modèle</span><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${((ev?.ap ?? 0) / max) * 100}%` }} /></div><span className="w-10 text-right tabular-nums">{fx(ev?.ap, 2) ?? '—'}</span></div>
                  <div className="flex items-center gap-2"><span className="w-12 text-stone-500">RFM</span><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-stone-400" style={{ width: `${((rfm?.ap ?? 0) / max) * 100}%` }} /></div><span className="w-10 text-right tabular-nums">{fx(rfm?.ap, 2) ?? '—'}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand-900 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 shrink-0 text-gold" />
          <p className="text-sm"><b>{kpi.actions} brouillons de courriels</b> peuvent être préparés en un clic. Chaque envoi reste validé par l'équipe.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/impact" className="flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"><TrendingUp className="size-4" /> Impact</Link>
          <Link to="/recommandations" className="flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brand-900 hover:brightness-95">Recommandations <ArrowRight className="size-4" /></Link>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-stone-400"><BrainCircuit className="size-3.5" /> Données de démonstration synthétiques, calibrées sur des taux de rétention publiés. Aucune donnée réelle d'organisation.</p>
      <DonorDrawer donorId={open} onClose={() => setOpen(null)} />
    </>
  )
}
