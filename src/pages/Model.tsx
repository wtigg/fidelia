import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { BrainCircuit, CheckCircle2, FlaskConical, Loader2, RefreshCw, Shuffle, Trophy } from 'lucide-react'
import { Badge, Button, Card, PageHeader, Stat, Tabs, Td, Th, cx } from '../components/ui.tsx'
import { formatPct } from '../lib/dates.ts'
import type { Features, ModelKind } from '../lib/types.ts'
import { FEATURE_KEYS, FEATURE_LABELS, toVector } from '../ml/features.ts'
import { ALGORITHM_LABELS, MODEL_KINDS, MODEL_SPECS, explain, predictWith, selectedModel, type Algorithm, type ModelReport } from '../ml/pipeline.ts'
import { useStore, type AlgoChoice } from '../state/store.tsx'

const ALGO_COLOR: Record<Algorithm, string> = { logistic: '#1f7a4d', gbdt: '#7c3aed', rule: '#a8a29e' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }

export default function Model() {
  const { reports, training, trainMs, retrain, trainOptions, algoChoice, setAlgo } = useStore()
  const [kind, setKind] = useState<ModelKind>('churn')
  const report = reports[kind]
  const spec = MODEL_SPECS[kind]

  return (
    <>
      <PageHeader
        title="Modèle IA"
        subtitle="Trois modèles prédictifs entraînés sur l'historique de vos donateurs, directement dans le navigateur. Aucun service externe : les données ne quittent pas l'application."
        actions={
          <Button variant="secondary" disabled={training} onClick={() => retrain()}>
            {training ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Réentraîner
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs<ModelKind> value={kind} onChange={setKind} items={MODEL_KINDS.map((k) => ({ value: k, label: MODEL_SPECS[k].title }))} />
      </div>

      <Method kind={kind} />

      {!report ? (
        <Card className="mt-6">
          <p className="px-6 py-16 text-center text-sm text-stone-500">{training ? 'Entraînement en cours…' : "Pas assez d'exemples pour entraîner ce modèle."}</p>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label="Exemples d'entraînement" value={report.nTrain.toLocaleString('fr-FR')} hint={`${report.positivesTrain} cas positifs`} />
            <Stat label="Exemples de test" value={report.nTest.toLocaleString('fr-FR')} hint="donateurs jamais vus" />
            <Stat label="Taux de base" value={formatPct(report.baseRate)} hint={spec.question.replace(/^Ce donateur /, '').replace(/ \?$/, '')} />
            <Stat
              label="Algorithme retenu"
              value={<span className="text-xl">{ALGORITHM_LABELS[report.selected]}</span>}
              hint={`AUC ${report.evaluations.find((e) => e.algorithm === report.selected)!.auc.toFixed(3)}${trainMs ? ` · entraîné en ${trainMs} ms` : ''}`}
              icon={<Trophy className="size-4" />}
              tone="gold"
            />
          </div>

          <Comparison report={report} choice={algoChoice[kind]} onChoice={(c) => setAlgo(kind, c)} />

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Roc report={report} />
            <Importance report={report} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Calibration report={report} />
            <Hyperparams busy={training} initial={trainOptions} onTrain={retrain} />
          </div>

          <Simulator key={kind} report={report} kind={kind} />
        </>
      )}
    </>
  )
}

function Method({ kind }: { kind: ModelKind }) {
  const spec = MODEL_SPECS[kind]
  const steps = [
    { t: 'Photo à une date T', d: `On calcule 8 variables par donateur avec uniquement les données antérieures à T. On répète pour ${spec.snapshotsMonthsAgo.length} dates différentes.` },
    { t: `On regarde les ${spec.horizonDays === 90 ? '90 jours' : '6 mois'} suivants`, d: spec.question.replace('Ce donateur', 'Le donateur').replace(' ?', ' ? Oui = 1, non = 0.') },
    { t: 'Entraînement', d: "Régression logistique et gradient boosting apprennent à relier les variables au résultat, sur 80 % des donateurs." },
    { t: 'Test honnête', d: 'Les 20 % de donateurs restants, jamais vus, servent à mesurer la performance et à choisir le meilleur algorithme.' },
  ]
  return (
    <Card>
      <div className="flex flex-col gap-6 p-6 lg:flex-row">
        <div className="lg:w-64">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <BrainCircuit className="size-5" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-stone-900">{spec.title}</h2>
          <p className="mt-1 text-sm text-stone-500">{spec.question}</p>
        </div>
        <ol className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-xl bg-stone-50 p-4">
              <span className="text-xs font-semibold text-brand-600">Étape {i + 1}</span>
              <p className="mt-1 text-sm font-medium text-stone-900">{s.t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}

function Comparison({ report, choice, onChoice }: { report: ModelReport; choice: AlgoChoice; onChoice: (c: AlgoChoice) => void }) {
  const best = Math.max(...report.evaluations.map((e) => e.auc))
  return (
    <Card className="mt-6" title="Comparaison des algorithmes" subtitle="Mesuré sur le jeu de test. L'AUC vaut 0,5 pour un tirage au hasard et 1 pour un modèle parfait.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-100">
            <tr>
              <Th>Algorithme</Th>
              <Th className="text-right">AUC</Th>
              <Th className="text-right">Lift top 10 %</Th>
              <Th className="text-right">Précision top 10 %</Th>
              <Th className="text-right">Rappel top 10 %</Th>
              <Th className="text-right">Log loss</Th>
              <Th className="text-right">Utilisé</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {report.evaluations.map((e) => (
              <tr key={e.algorithm}>
                <Td>
                  <span className="flex items-center gap-2 font-medium text-stone-900">
                    <i className="size-2.5 rounded-full" style={{ background: ALGO_COLOR[e.algorithm] }} />
                    {ALGORITHM_LABELS[e.algorithm]}
                    {e.auc === best && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Meilleur</Badge>}
                  </span>
                </Td>
                <Td className="text-right font-semibold tabular-nums">{e.auc.toFixed(3)}</Td>
                <Td className="text-right tabular-nums">{e.top10.lift.toFixed(2)}×</Td>
                <Td className="text-right tabular-nums">{formatPct(e.top10.precision)}</Td>
                <Td className="text-right tabular-nums">{formatPct(e.top10.recall)}</Td>
                <Td className="text-right tabular-nums text-stone-500">{e.logLoss?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right">
                  {e.algorithm === 'rule' ? (
                    <span className="text-xs text-stone-400">référence</span>
                  ) : report.selected === e.algorithm ? (
                    <CheckCircle2 className="ml-auto size-5 text-brand-600" />
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onChoice(e.algorithm as AlgoChoice)}>Utiliser</Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
        <span>Lift top 10 % : parmi les 10 % de donateurs les mieux scorés, combien de fois plus de cas réels qu'en ciblant au hasard.</span>
        {choice !== 'auto' && (
          <button className="font-medium text-brand-600" onClick={() => onChoice('auto')}>Revenir au choix automatique</button>
        )}
      </div>
    </Card>
  )
}

function Roc({ report }: { report: ModelReport }) {
  return (
    <Card title="Courbe ROC" subtitle="Plus la courbe monte vite à gauche, mieux le modèle sépare les cas positifs des négatifs.">
      <div className="h-80 p-4">
        <ResponsiveContainer>
          <LineChart margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#f0eeec" />
            <XAxis type="number" dataKey="fpr" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: '#a8a29e' }} label={{ value: 'Faux positifs', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#78716c' }} />
            <YAxis type="number" dataKey="tpr" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: '#a8a29e' }} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v) * 100)} %`} labelFormatter={(v) => `Faux positifs ${Math.round(Number(v) * 100)} %`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" name="Hasard" stroke="#d6d3d1" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            {report.evaluations.map((e) => (
              <Line key={e.algorithm} data={e.roc} dataKey="tpr" name={`${ALGORITHM_LABELS[e.algorithm]} (${e.auc.toFixed(2)})`} stroke={ALGO_COLOR[e.algorithm]} strokeWidth={e.algorithm === report.selected ? 2.5 : 1.5} dot={false} type="monotone" isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Importance({ report }: { report: ModelReport }) {
  const [algo, setAlgo] = useState<Algorithm>(report.selected)
  const ev = report.evaluations.find((e) => e.algorithm === algo)!
  const items = ev.importance ?? []
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.01)
  return (
    <Card
      title="Variables les plus importantes"
      subtitle={algo === 'logistic' ? 'Poids normalisés : le sens indique si la variable augmente ou diminue la probabilité.' : 'Gain cumulé apporté par chaque variable dans les arbres.'}
      action={
        <select value={algo} onChange={(e) => setAlgo(e.target.value as Algorithm)} className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs">
          <option value="logistic">Logistique</option>
          <option value="gbdt">Boosting</option>
        </select>
      }
    >
      <ul className="space-y-3 p-5">
        {items.map((i) => {
          const up = i.value >= 0
          return (
            <li key={i.feature}>
              <div className="flex justify-between text-sm">
                <span className="text-stone-800">{FEATURE_LABELS[i.feature]}</span>
                {algo === 'logistic' && <span className={cx('text-xs font-medium', up ? 'text-rose-600' : 'text-sky-700')}>{up ? '↑ augmente' : '↓ diminue'}</span>}
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(Math.abs(i.value) / max) * 100}%`, background: algo === 'gbdt' ? ALGO_COLOR.gbdt : up ? '#e11d48' : '#0284c7' }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Calibration({ report }: { report: ModelReport }) {
  const ev = report.evaluations.find((e) => e.algorithm === report.selected)!
  const data = (ev.calibration ?? []).map((c) => ({ x: c.predicted, y: c.observed, n: c.n }))
  const max = Math.max(0.1, ...data.map((d) => Math.max(d.x, d.y))) * 1.1
  return (
    <Card title="Calibration" subtitle="Quand le modèle annonce 30 %, observe-t-on vraiment 30 % ? Les points doivent suivre la diagonale.">
      <div className="h-72 p-4">
        <ResponsiveContainer>
          <ScatterChart margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#f0eeec" />
            <XAxis type="number" dataKey="x" domain={[0, max]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: '#a8a29e' }} name="Prédit" label={{ value: 'Probabilité prédite', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#78716c' }} />
            <YAxis type="number" dataKey="y" domain={[0, max]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: '#a8a29e' }} width={44} name="Observé" />
            <ZAxis dataKey="n" range={[40, 160]} name="Exemples" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === 'Exemples' ? v : `${Math.round(Number(v) * 100)} %`)} />
            <Scatter data={[{ x: 0, y: 0 }, { x: max, y: max }]} line={{ stroke: '#d6d3d1', strokeDasharray: '4 4' }} shape={() => <g />} isAnimationActive={false} />
            <Scatter data={data} fill={ALGO_COLOR[report.selected]} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Hyperparams({ busy, initial, onTrain }: { busy: boolean; initial: { epochs?: number; l2?: number; rounds?: number; depth?: number }; onTrain: (o: { epochs: number; l2: number; rounds: number; depth: number }) => void }) {
  const [o, setO] = useState({ epochs: initial.epochs ?? 600, l2: initial.l2 ?? 0.01, rounds: initial.rounds ?? 80, depth: initial.depth ?? 3 })
  const fields = [
    { k: 'epochs', label: "Itérations (logistique)", min: 50, max: 2000, step: 50, help: 'Nombre de passes de descente de gradient.' },
    { k: 'l2', label: 'Régularisation L2 (logistique)', min: 0, max: 0.2, step: 0.005, help: 'Pénalise les poids trop grands pour éviter le sur-apprentissage.' },
    { k: 'rounds', label: 'Nombre d\'arbres (boosting)', min: 5, max: 300, step: 5, help: 'Chaque arbre corrige les erreurs des précédents.' },
    { k: 'depth', label: 'Profondeur des arbres', min: 1, max: 6, step: 1, help: 'Plus profond = interactions plus complexes, risque de sur-apprentissage.' },
  ] as const
  return (
    <Card title="Hyperparamètres" subtitle="Modifiez et réentraînez pour voir l'effet sur les métriques." action={<FlaskConical className="size-5 text-stone-400" />}>
      <div className="space-y-5 p-5">
        {fields.map((f) => (
          <label key={f.k} className="block">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-stone-800">{f.label}</span>
              <span className="tabular-nums text-stone-600">{o[f.k]}</span>
            </div>
            <input type="range" min={f.min} max={f.max} step={f.step} value={o[f.k]} onChange={(e) => setO({ ...o, [f.k]: Number(e.target.value) })} className="mt-1.5 w-full accent-brand-600" />
            <p className="text-xs text-stone-400">{f.help}</p>
          </label>
        ))}
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => onTrain(o)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Réentraîner les 3 modèles
        </Button>
      </div>
    </Card>
  )
}

const RANGES: Record<keyof Features, { min: number; max: number; step: number; fmt: (v: number) => string }> = {
  recencyDays: { min: 0, max: 900, step: 5, fmt: (v) => `${v} j` },
  gifts12m: { min: 0, max: 14, step: 1, fmt: (v) => `${v}` },
  amount12m: { min: 0, max: 1500, step: 10, fmt: (v) => `${v} €` },
  tenureMonths: { min: 0, max: 40, step: 1, fmt: (v) => `${v} mois` },
  failed90d: { min: 0, max: 3, step: 1, fmt: (v) => `${v}` },
  openRate3m: { min: 0, max: 0.8, step: 0.01, fmt: (v) => `${Math.round(v * 100)} %` },
  engagementTrend: { min: -0.4, max: 0.4, step: 0.01, fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts` },
  amountTrend: { min: -3, max: 3, step: 0.1, fmt: (v) => v.toFixed(1) },
}

function Simulator({ report, kind }: { report: ModelReport; kind: ModelKind }) {
  const { scores } = useStore()
  const pool = useMemo(() => scores.filter((s) => (kind === 'churn' ? s.segment === 'monthly' : kind === 'reactivation' ? s.segment === 'lapsed' : s.segment === 'one_time' || s.segment === 'annual')), [scores, kind])
  const [f, setF] = useState<Features>(() => pool[Math.floor(pool.length / 2)]?.features ?? { recencyDays: 30, gifts12m: 4, amount12m: 200, tenureMonths: 12, failed90d: 0, openRate3m: 0.3, engagementTrend: 0, amountTrend: 0 })
  const x = toVector(f)
  const p = predictWith(selectedModel(report), x)
  const reasons = explain(report, x, f)

  return (
    <Card className="mt-6" title="Simulateur de prédiction" subtitle="Bougez les variables et observez la réaction du modèle en temps réel." action={
      <Button size="sm" variant="secondary" onClick={() => pool.length && setF(pool[Math.floor(Math.random() * pool.length)].features)}>
        <Shuffle className="size-3.5" /> Donateur au hasard
      </Button>
    }>
      <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-[1fr_300px]">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {FEATURE_KEYS.map((k) => (
            <label key={k} className="block">
              <div className="flex justify-between text-sm">
                <span className="text-stone-700">{FEATURE_LABELS[k]}</span>
                <span className="font-medium tabular-nums text-stone-900">{RANGES[k].fmt(f[k])}</span>
              </div>
              <input
                type="range"
                min={RANGES[k].min}
                max={Math.max(RANGES[k].max, f[k])}
                step={RANGES[k].step}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
                className="mt-1 w-full accent-brand-600"
              />
            </label>
          ))}
        </div>
        <div className="rounded-2xl bg-brand-900 p-6 text-white">
          <p className="text-sm text-brand-100/80">{MODEL_SPECS[kind].title}</p>
          <p className="mt-2 font-display text-6xl font-semibold tabular-nums">{Math.round(p * 100)}<span className="text-3xl"> %</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${p * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-brand-100/70">Moyenne observée : {formatPct(report.baseRate)} · {ALGORITHM_LABELS[report.selected]}</p>
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100/60">Ce qui fait monter le score</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {reasons.length ? reasons.map((r) => <li key={r.feature}>• {r.text}</li>) : <li className="text-brand-100/70">Rien de notable</li>}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  )
}
