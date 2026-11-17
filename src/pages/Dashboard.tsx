import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, HandCoins, Repeat, Sparkles, TrendingUp, Users } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { TechDetails } from '../components/plain/TechDetails.tsx'
import { Term } from '../components/plain/Term.tsx'
import { WHO, times } from '../components/plain/words.ts'
import { Badge, Card, PageHeader, ProbBar, Stat } from '../components/ui.tsx'
import { actionStats } from '../lib/actionStats.ts'
import { addMonths, formatMoney, monthIndex, fx } from '../lib/dates.ts'
import { DEFAULT_EFFECT, simulate, valueAtStake } from '../lib/impact.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS, ACTION_MODEL, ACTION_TONE, ACTION_TYPES, PROB_WORD, SEGMENT_LABELS } from '../lib/labels.ts'
import { REQUIREMENTS } from '../lib/requirements.ts'
import type { Segment } from '../lib/types.ts'
import { MODEL_KINDS, MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'
import kdd from '../data/kdd98.json'

const monthFmt = new Intl.DateTimeFormat('fr-CA', { month: 'short', timeZone: 'UTC' })
/** Noms simples des contrôles R1 à R6 (détail dans la page Modèle IA) */
const CHECK_NAMES: Record<string, string> = {
  R1: 'mieux que le hasard',
  R2: 'mieux que la méthode habituelle',
  R3: '50 premiers noms',
  R4: 'pourcentages fiables',
  R5: 'stable dans le temps',
  R6: 'équité par âge',
}

/** Verdict sur de vrais donateurs (KDD Cup 1998), le même que sur la page Impact */
function realDonorsVerdict(): boolean {
  const reac = (kdd as unknown as { reactivation: { baseRate: number; selected: string; evaluations: { algorithm: string; ap: number; apDiffVsRfmCI?: [number, number] }[] } }).reactivation
  const sel = reac.evaluations.find((e) => e.algorithm === reac.selected)
  return !!sel && sel.ap >= 2 * reac.baseRate && (sel.apDiffVsRfmCI?.[0] ?? -1) > 0
}

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
      ACTION_TYPES.map((type) => ({ type, ...actionStats(scores, type) })),
    [scores],
  )

  const top = scores.filter((s) => s.action && s.action !== 'thank').slice(0, 6)
  const checks = MODEL_KINDS.flatMap((k) => (reports[k] ? REQUIREMENTS.map((r) => ({ kind: k, id: r.id, ok: r.check(reports[k]!).ok })) : []))
  const failed = MODEL_KINDS.map((k) => ({ kind: k, ids: checks.filter((c) => c.kind === k && !c.ok).map((c) => c.id) })).filter((f) => f.ids.length)
  const reacReal = realDonorsVerdict()

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
        <Stat label="Dons mensuels à risque" value={formatMoney(kpi.atRisk)} hint="par an, selon la chance que chacun arrête" icon={<AlertTriangle className="size-4" />} tone="bad" />
        <Link to="/impact" className="block transition-transform hover:-translate-y-0.5">
          <Stat label="Récupérable (300 contacts)" value={formatMoney(kpi.recoverable)} hint={<span className="text-brand-700">+{formatMoney(kpi.vsRfm)} de plus que la méthode habituelle →</span>} icon={<HandCoins className="size-4" />} tone="gold" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Dons collectés" subtitle="24 derniers mois, par type de don. Pic de décembre : période des fêtes et reçus fiscaux.">
          <div className="h-72 px-2 py-4">
            {/* Sans animation d'entrée : Recharts révèle les aires de gauche à droite (1,5 s). Pendant l'entraînement
                (worker) ou sur une capture d'écran, la révélation s'arrêtait vers 70 % de la largeur alors que l'axe continuait. */}
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 4, right: 12, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#f0eeec" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} k$`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v, n) => [formatMoney(Number(v)), n === 'monthly' ? 'Mensuel' : n === 'annual' ? 'Annuel' : 'Ponctuel']} />
                <Area type="monotone" dataKey="monthly" stackId="1" isAnimationActive={false} stroke="#1f7a4d" fill="#1f7a4d" fillOpacity={0.85} />
                <Area type="monotone" dataKey="annual" stackId="1" isAnimationActive={false} stroke="#0284c7" fill="#0284c7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="one_time" stackId="1" isAnimationActive={false} stroke="#f4c95d" fill="#f4c95d" fillOpacity={0.8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Base de donateurs" subtitle="Où en sont vos donateurs à la date d'analyse">
          <div className="flex items-center gap-4 p-5">
            <div className="size-36 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={segments} dataKey="value" isAnimationActive={false} innerRadius={42} outerRadius={68} paddingAngle={2} stroke="none">
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
        <Card className="xl:col-span-2" title="Priorités du jour" subtitle="Classés par dollars à gagner sur un an" action={<Link to="/recommandations" className="text-sm font-medium text-brand-600 hover:text-brand-700">Tout voir</Link>}>
          <ul className="divide-y divide-stone-100">
            {top.map((s) => {
              const d = donorsById.get(s.donorId)!
              return (
                <li key={s.donorId}>
                  <button onClick={() => setOpen(s.donorId)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-stone-50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">{d.firstName[0]}{d.lastName[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{d.firstName} {d.lastName}</p>
                      <p className="mt-1 sm:hidden"><Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge></p>
                      <p className="hidden truncate text-xs text-stone-500 sm:block">{s.reasons.map((r) => r.text).join(' · ')}</p>
                    </div>
                    <span className="hidden sm:inline"><Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge></span>
                    <div className="hidden sm:block"><ProbBar value={s.actionProb} color={ACTION_COLOR[s.action!]} width="w-12" word={PROB_WORD(s.action)} /></div>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums text-stone-900">{formatMoney(s.expectedValue)}</span>
                  </button>
                </li>
              )
            })}
            {!top.length && <li className="px-5 py-10 text-center text-sm text-stone-500">{training ? 'Calcul en cours…' : 'Aucune action au-dessus des seuils.'}</li>}
          </ul>
        </Card>

        <Card title="Actions recommandées" subtitle="Les listes de la semaine et les dons espérés sur un an" action={<Link to="/automatisations" className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700">Régler les listes</Link>}>
          <ul className="divide-y divide-stone-100">
            {byAction.filter(({ count }) => count > 0).map(({ type, count, value }) => (
              <li key={type}>
                <Link to={`/recommandations?type=${type}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                  <span className="h-8 w-1 rounded-full" style={{ background: ACTION_COLOR[type] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900">{ACTION_LABELS[type]}</p>
                    <p className="truncate text-xs text-stone-500">{ACTION_DESCRIPTIONS[type]}</p>
                    {ACTION_MODEL[type] && reports[ACTION_MODEL[type]!]?.deployed === 'rfm' && (
                      <p className="mt-0.5 text-xs text-amber-800">Liste courte : ici, le modèle ne fait pas mieux. Fidélia classe avec la méthode habituelle.</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">{count}</p>
                    <p className="text-xs tabular-nums text-stone-500">{type === 'thank' ? '—' : formatMoney(value)}</p>
                  </div>
                </Link>
              </li>
            ))}
            {byAction.some(({ count }) => count === 0) && (
              <li className="px-5 py-3 text-xs text-stone-500">
                Aucun donateur aujourd'hui pour : {byAction.filter(({ count }) => count === 0).map(({ type }) => ACTION_LABELS[type]).join(', ')}.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-6" title="Fidélia fait-il mieux que la méthode habituelle ?" subtitle={<>Testé sur des <Term k="jamaisVus">donateurs jamais vus</Term>. <Term k="methode">Méthode habituelle</Term> : trier par dernier don, fréquence et montant.</>} action={
        <Link to="/modele" className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600"><CheckCircle2 className="size-4" />Voir les vérifications</Link>
      }>
        <div className="grid grid-cols-1 gap-px bg-stone-100 sm:grid-cols-2 xl:grid-cols-4">
          {MODEL_KINDS.map((k) => {
            const r = reports[k]
            const shown = r?.deployed === 'rfm' ? r.selected : r?.deployed
            const ev = r?.evaluations.find((e) => e.algorithm === shown)
            const rfm = r?.evaluations.find((e) => e.algorithm === 'rfm')
            const ratio = ev ? ev.ap / Math.max(rfm?.ap ?? 1, 1e-6) : NaN
            const t = times(ratio)
            const fallback = r?.deployed === 'rfm'
            return (
              <div key={k} className="bg-white p-5">
                <p className="flex items-center justify-between gap-2 text-sm font-medium text-stone-800">
                  {MODEL_SPECS[k].title}
                  {r && !r.deployedAuto ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800" title="Choix imposé à la main dans la page Modèle IA">Choix manuel</span>
                  ) : fallback ? (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600" title="Le modèle ne remplit pas nos deux conditions : Fidélia garde la méthode habituelle">Méthode habituelle</span>
                  ) : k === 'reactivation' && !reacReal && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800" title="Testé sur de vrais donateurs : la méthode est validée, mais ce modèle ne remplit pas encore nos deux conditions">À confirmer</span>
                  )}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{t ? `×${t}` : '—'}</p>
                <p className="mt-1 text-[13px] leading-snug text-stone-600">
                  {!r ? 'En attente des données.' : fallback
                    ? <>Le modèle ne fait pas assez nettement mieux pour trouver {WHO[k]}. Fidélia garde donc la méthode habituelle pour cette liste.</>
                    : t
                      ? <>Fidélia repère {WHO[k]} avec une précision <b>{t} fois</b> plus grande que la méthode habituelle.</>
                      : <>Ici, Fidélia ne fait pas mieux que la méthode habituelle.</>}
                </p>
                {k === 'reactivation' && r && !fallback && !reacReal && (
                  <p className="mt-2 text-[12px] leading-snug text-amber-800">Sur nos données fictives seulement. Sur de vrais donateurs, ce modèle ne remplit pas encore nos deux conditions (page Impact).</p>
                )}
              </div>
            )
          })}
        </div>
        <div className="border-t border-stone-100 px-5 py-3">
          <TechDetails>
            <div className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2 xl:grid-cols-4">
              {MODEL_KINDS.map((k) => {
                const r = reports[k]
                const shown = r?.deployed === 'rfm' ? r.selected : r?.deployed
                const ev = r?.evaluations.find((e) => e.algorithm === shown)
                const rfm = r?.evaluations.find((e) => e.algorithm === 'rfm')
                const max = Math.max(ev?.ap ?? 0, rfm?.ap ?? 0, 0.01)
                return (
                  <div key={k} className="text-xs">
                    <p className="mb-1.5 font-medium text-stone-700">{MODEL_SPECS[k].title} · AUC-PR</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2"><span className="w-12 text-stone-500">Modèle</span><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${((ev?.ap ?? 0) / max) * 100}%` }} /></div><span className="w-10 text-right tabular-nums">{fx(ev?.ap, 2) ?? '—'}</span></div>
                      <div className="flex items-center gap-2"><span className="w-12 text-stone-500">RFM</span><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-stone-400" style={{ width: `${((rfm?.ap ?? 0) / max) * 100}%` }} /></div><span className="w-10 text-right tabular-nums">{fx(rfm?.ap, 2) ?? '—'}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-stone-500">
              Le chiffre ×N est le rapport entre l'<Term k="precision">AUC-PR</Term> du modèle et celle de la règle RFM, mesurées sur le jeu de test. Le modèle n'est utilisé que s'il passe les requis R1 et R2 (<Term k="conditions">nos deux conditions</Term>).
            </p>
            <p className="mt-2 text-xs text-stone-500">
              {checks.filter((c) => c.ok).length} contrôles réussis sur {checks.length} (R1 à R6, pour chacun des quatre modèles).
              {failed.length > 0 && <> Non réussis : {failed.map((f) => `${MODEL_SPECS[f.kind].title} (${f.ids.map((id) => CHECK_NAMES[id] ?? id).join(', ')})`).join(' ; ')}. Détail et valeurs dans la page Modèle IA.</>}
            </p>
          </TechDetails>
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
