import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, BrainCircuit, HandCoins, Repeat, Sparkles, Users } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { Badge, Card, PageHeader, ProbBar, Stat } from '../components/ui.tsx'
import { addMonths, formatEur, monthIndex } from '../lib/dates.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS, ACTION_TONE } from '../lib/labels.ts'
import type { ActionType } from '../lib/types.ts'
import { MODEL_KINDS, MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
const ACTIONS: ActionType[] = ['churn_prevention', 'upgrade_one_time', 'upgrade_annual', 'reactivation']

export default function Dashboard() {
  const { dataset, scores, donorsById, reports, training } = useStore()
  const [open, setOpen] = useState<string | null>(null)

  const kpi = useMemo(() => {
    const monthly = scores.filter((s) => s.segment === 'monthly')
    const mrr = monthly.reduce((s, x) => s + (donorsById.get(x.donorId)?.monthlyAmount ?? 0), 0)
    const atRisk = monthly.reduce((s, x) => s + (x.churnProb ?? 0) * (donorsById.get(x.donorId)?.monthlyAmount ?? 0) * 12, 0)
    const actions = scores.filter((s) => s.action)
    const potential = actions.reduce((s, x) => s + x.expectedValue, 0)
    const active = scores.filter((s) => s.segment !== 'lapsed').length
    return { monthly: monthly.length, mrr, atRisk, actions: actions.length, potential, active }
  }, [scores, donorsById])

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

  const byAction = useMemo(
    () =>
      ACTIONS.map((type) => {
        const list = scores.filter((s) => s.action === type)
        return { type, count: list.length, value: list.reduce((s, x) => s + x.expectedValue, 0) }
      }),
    [scores],
  )

  const top = scores.filter((s) => s.action).slice(0, 6)

  return (
    <>
      <PageHeader
        title="Bonjour 👋"
        subtitle={
          training
            ? 'Le modèle analyse vos donateurs…'
            : `Le modèle a analysé ${dataset.donors.length.toLocaleString('fr-FR')} donateurs et recommande ${kpi.actions} actions pour un potentiel de ${formatEur(kpi.potential)} par an.`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Donateurs actifs" value={kpi.active.toLocaleString('fr-FR')} hint={`dont ${kpi.monthly} mensuels`} icon={<Users className="size-4" />} />
        <Stat label="Dons mensuels récurrents" value={formatEur(kpi.mrr)} hint={`soit ${formatEur(kpi.mrr * 12)} par an`} icon={<Repeat className="size-4" />} tone="good" />
        <Stat label="Revenu à risque (90 j)" value={formatEur(kpi.atRisk)} hint="par an, pondéré par le risque de churn" icon={<AlertTriangle className="size-4" />} tone="bad" />
        <Stat label="Potentiel des recommandations" value={formatEur(kpi.potential)} hint={`${kpi.actions} actions à mener`} icon={<HandCoins className="size-4" />} tone="gold" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Dons collectés" subtitle="24 derniers mois, par type de don">
          <div className="h-72 px-2 py-4">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 4, right: 12, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#f0eeec" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} k€`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v, n) => [formatEur(Number(v)), n === 'monthly' ? 'Mensuel' : n === 'annual' ? 'Annuel' : 'Ponctuel']} />
                <Area type="monotone" dataKey="monthly" stackId="1" stroke="#1f7a4d" fill="#1f7a4d" fillOpacity={0.85} />
                <Area type="monotone" dataKey="annual" stackId="1" stroke="#0284c7" fill="#0284c7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="one_time" stackId="1" stroke="#f4c95d" fill="#f4c95d" fillOpacity={0.8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-brand-500" /> Mensuel</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-sky-600" /> Annuel</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-gold" /> Ponctuel</span>
          </div>
        </Card>

        <Card title="Actions recommandées" subtitle="Calculées par le modèle aujourd'hui" action={<Link to="/recommandations" className="text-sm font-medium text-brand-600 hover:text-brand-700">Tout voir</Link>}>
          <ul className="divide-y divide-stone-100">
            {byAction.map(({ type, count, value }) => (
              <li key={type}>
                <Link to={`/recommandations?type=${type}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50">
                  <span className="h-9 w-1 rounded-full" style={{ background: ACTION_COLOR[type] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900">{ACTION_LABELS[type]}</p>
                    <p className="truncate text-xs text-stone-500">{ACTION_DESCRIPTIONS[type]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">{count}</p>
                    <p className="text-xs tabular-nums text-stone-500">{formatEur(value)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Priorités du jour" subtitle="Donateurs où une action rapporte le plus (probabilité × valeur)">
          <ul className="divide-y divide-stone-100">
            {top.map((s) => {
              const d = donorsById.get(s.donorId)!
              return (
                <li key={s.donorId}>
                  <button onClick={() => setOpen(s.donorId)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-stone-50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {d.firstName[0]}
                      {d.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">
                        {d.firstName} {d.lastName}
                      </p>
                      <p className="truncate text-xs text-stone-500">{s.reasons.map((r) => r.text).join(' · ')}</p>
                    </div>
                    <Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge>
                    <div className="hidden sm:block">
                      <ProbBar value={s.actionProb} color={ACTION_COLOR[s.action!]} width="w-16" />
                    </div>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums text-stone-900">{formatEur(s.expectedValue)}</span>
                  </button>
                </li>
              )
            })}
            {!top.length && <li className="px-5 py-10 text-center text-sm text-stone-500">{training ? 'Calcul en cours…' : 'Aucune action au-dessus des seuils.'}</li>}
          </ul>
        </Card>

        <Card title="Santé du modèle" subtitle="Mesurée sur des donateurs jamais vus à l'entraînement" action={<Link to="/modele" className="text-sm font-medium text-brand-600 hover:text-brand-700">Détails</Link>}>
          <ul className="space-y-4 p-5">
            {MODEL_KINDS.map((k) => {
              const r = reports[k]
              const ev = r?.evaluations.find((e) => e.algorithm === r.selected)
              const rule = r?.evaluations.find((e) => e.algorithm === 'rule')
              return (
                <li key={k}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-800">{MODEL_SPECS[k].title}</span>
                    <span className="tabular-nums text-stone-500">AUC {ev ? ev.auc.toFixed(2) : '—'}</span>
                  </div>
                  <div className="relative mt-2 h-2 rounded-full bg-stone-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${ev ? ((ev.auc - 0.5) / 0.5) * 100 : 0}%` }} />
                    {rule && <div className="absolute -top-1 h-4 w-0.5 bg-stone-400" style={{ left: `${Math.max(0, ((rule.auc - 0.5) / 0.5) * 100)}%` }} title="Règle métier" />}
                  </div>
                  {ev && (
                    <p className="mt-1.5 text-xs text-stone-500">
                      Les 10 % mieux classés contiennent <b className="text-stone-700">{ev.top10.lift.toFixed(1)}×</b> plus de cas que le hasard
                    </p>
                  )}
                </li>
              )
            })}
            <li className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
              <BrainCircuit className="mt-0.5 size-4 shrink-0 text-brand-600" />
              Trait gris : performance d'une règle métier simple. La barre verte doit la dépasser.
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-brand-900 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 text-gold" />
          <p className="text-sm">
            <b>{kpi.actions} emails personnalisés</b> peuvent être préparés en un clic à partir des recommandations.
          </p>
        </div>
        <Link to="/recommandations" className="flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brand-900 hover:brightness-95">
          Voir <ArrowRight className="size-4" />
        </Link>
      </div>

      <DonorDrawer donorId={open} onClose={() => setOpen(null)} />
    </>
  )
}
