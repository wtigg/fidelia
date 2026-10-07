import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { AlertTriangle, BrainCircuit, CheckCircle2, Database, Loader2, RefreshCw, Shuffle, Trophy, XCircle } from 'lucide-react'
import { Badge, Button, Card, PageHeader, Stat, Tabs, Td, Th, cx } from '../components/ui.tsx'
import { formatMoney, formatPct, fx } from '../lib/dates.ts'
import { MODEL_COLOR } from '../lib/labels.ts'
import { REQUIREMENTS } from '../lib/requirements.ts'
import type { Features, ModelKind } from '../lib/types.ts'
import type { Algorithm, Evaluation, ExperimentResult } from '../ml/experiment.ts'
import { FEATURE_KEYS, FEATURE_LABELS, toVector } from '../ml/features.ts'
import { ALGORITHM_LABELS, MODEL_KINDS, MODEL_SPECS, explain, predictReport, type ModelReport } from '../ml/pipeline.ts'
import { useStore, type AlgoChoice } from '../state/store.tsx'
import kdd from '../data/kdd98.json'

const ALGO_COLOR: Record<Algorithm, string> = { logistic: '#1f7a4d', gbdt: '#7c3aed', ensemble: '#d97706', rfm: '#a8a29e' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }
const axis = { tick: { fontSize: 11, fill: '#a8a29e' } }
const pctTick = (v: number) => `${Math.round(v * 100)}%`
type Tab = ModelKind | 'kdd'

export default function Model() {
  const { reports, training, trainingStep, trainMs, retrain, algoChoice, setAlgo, modelVersion } = useStore()
  const [tab, setTab] = useState<Tab>('churn')
  const report = tab !== 'kdd' ? reports[tab] : undefined

  return (
    <>
      <PageHeader
        title="Modèle IA"
        subtitle="Quatre modèles prédictifs entraînés sur l'historique des donateurs, dans le navigateur. Chaque modèle est comparé à la règle RFM, la méthode traditionnelle des collecteurs de fonds, et validé sur des donateurs jamais vus."
        actions={
          <>
            <Badge>Version {modelVersion}</Badge>
            <Button variant="secondary" disabled={training} onClick={retrain}>
              {training ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {training ? `Entraînement… ${trainingStep ? MODEL_SPECS[trainingStep].title : ''}` : 'Réentraîner'}
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[...MODEL_KINDS.map((k) => ({ value: k as Tab, label: MODEL_SPECS[k].title })), { value: 'kdd', label: <span className="flex items-center gap-1.5"><Database className="size-3.5" />Données réelles</span> }]}
        />
      </div>

      {tab === 'kdd' ? (
        <RealData />
      ) : (
        <>
          <Method kind={tab} />
          {!report ? (
            <Card className="mt-6">
              <p className="px-6 py-16 text-center text-sm text-stone-500">{training ? 'Entraînement en cours…' : "Pas assez d'exemples pour entraîner ce modèle."}</p>
            </Card>
          ) : (
            <ModelDetail report={report} kind={tab} choice={algoChoice[tab] ?? 'auto'} onChoice={(c) => setAlgo(tab, c)} trainMs={trainMs} />
          )}
        </>
      )}
    </>
  )
}

function ModelDetail({ report, kind, choice, onChoice, trainMs }: { report: ModelReport; kind: ModelKind; choice: AlgoChoice; onChoice: (c: AlgoChoice) => void; trainMs?: number }) {
  const sel = report.evaluations.find((e) => e.algorithm === report.selected)!
  const rfm = report.evaluations.find((e) => e.algorithm === 'rfm')!
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Exemples (entraîn. / valid. / test)" value={<span className="text-xl">{report.nTrain.toLocaleString('fr-CA')} / {report.nVal.toLocaleString('fr-CA')} / {report.nTest.toLocaleString('fr-CA')}</span>} hint={`${report.positivesTrain} cas positifs à l'entraînement`} />
        <Stat label="Taux de base" value={formatPct(report.baseRate)} hint="part des cas positifs : la cible est rare" />
        <Stat label="AUC-PR du modèle" value={fx(sel.ap, 3)} hint={`règle RFM : ${fx(rfm.ap, 3)} · ×${fx((sel.ap / Math.max(rfm.ap, 1e-6)), 1)}`} tone="good" />
        <Stat label="Utilisé pour classer" value={<span className="text-xl">{ALGORITHM_LABELS[report.deployed]}</span>} hint={report.deployed === 'rfm' ? 'le modèle ne bat pas la règle : repli sur RFM' : `meilleur sur la validation, R1 et R2 validés${trainMs ? ` · ${fx(trainMs / 1000, 1)} s` : ''}`} icon={<Trophy className="size-4" />} tone={report.deployed === 'rfm' ? 'default' : 'gold'} />
      </div>

      <Requirements report={report} />
      <Comparison report={report} choice={choice} onChoice={onChoice} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Curves evaluations={report.evaluations} selected={report.deployed} baseRate={report.baseRate} />
        <Importance report={report} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Calibration evaluation={sel} color={ALGO_COLOR[report.selected]} />
        <Validation report={report} />
      </div>

      <Fairness report={report} />
      <Simulator key={kind} report={report} kind={kind} />
    </>
  )
}

function Method({ kind }: { kind: ModelKind }) {
  const spec = MODEL_SPECS[kind]
  const steps = [
    { t: 'Photo à une date T', d: `18 variables par donateur, calculées seulement avec les données antérieures à T. Répété pour ${spec.snapshotsMonthsAgo.length} dates.` },
    { t: `Étiquette à ${spec.horizonDays === 90 ? '90 jours' : '6 mois'}`, d: spec.question.replace('Ce donateur', 'Le donateur').replace(' ?', ' ? 1 = oui, 0 = non.') },
    { t: 'Découpage par donateur', d: '60 % entraînement, 20 % validation, 20 % test. Un donateur n\'apparaît que dans un seul jeu.' },
    { t: 'Réglage sur la validation', d: 'Régularisation, profondeur et nombre d\'arbres (arrêt précoce), puis choix de l\'algorithme par AUC-PR.' },
    { t: 'Test unique', d: 'Mesure sur le test avec IC 95 % par bootstrap, puis test temporel : entraîner sur le passé, tester sur les dates récentes.' },
  ]
  return (
    <Card>
      <div className="flex flex-col gap-6 p-6 2xl:flex-row">
        <div className="2xl:w-60">
          <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: MODEL_COLOR[kind] }}>
            <BrainCircuit className="size-5" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-stone-900">{spec.title}</h2>
          <p className="mt-1 text-sm text-stone-500">{spec.question}</p>
          <p className="mt-2 text-xs text-stone-400">Action associée : {spec.action}</p>
        </div>
        <ol className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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

function Requirements({ report }: { report: ModelReport }) {
  const results = REQUIREMENTS.map((r) => ({ ...r, ...r.check(report) }))
  const passed = results.filter((r) => r.ok).length
  const fallback = report.deployed === 'rfm'
  return (
    <Card className="mt-6" title="Requis de performance" subtitle={`Fixés avant l'entraînement, vérifiés à chaque réentraînement, pour le meilleur modèle candidat (${ALGORITHM_LABELS[report.selected]}).`} action={<Badge className={passed === results.length ? 'bg-brand-50 text-brand-700 ring-brand-100' : 'bg-amber-50 text-amber-800 ring-amber-200'}>{passed}/{results.length} validés</Badge>}>
      <div className={cx('flex items-start gap-3 border-b px-5 py-3 text-sm', fallback ? 'border-amber-100 bg-amber-50 text-amber-900' : 'border-brand-100 bg-brand-50 text-brand-900')}>
        {fallback ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
        <p>
          <b>Décision de déploiement : </b>
          {fallback
            ? 'le modèle ne bat pas nettement la règle RFM (R1 ou R2 non validé). Fidélia utilise donc la règle RFM pour cette liste, conformément à la règle de gouvernance de l\'équipe.'
            : `le modèle bat la règle RFM (R1 et R2 validés) : ${ALGORITHM_LABELS[report.deployed]} est utilisé pour classer les donateurs.`}
          {!report.deployedAuto && ' (Choix imposé manuellement.)'}
        </p>
      </div>
      <ul className="divide-y divide-stone-100">
        {results.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-5 py-3">
            {r.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-900"><span className="text-stone-400">{r.id} · </span>{r.label}</p>
              <p className="text-xs text-stone-500">{r.why}</p>
            </div>
            <span className="shrink-0 text-right text-xs tabular-nums text-stone-600">{r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const ci = (v: [number, number], d = 3) => `${v[0].toFixed(d)}–${v[1].toFixed(d)}`

function Comparison({ report, choice, onChoice }: { report: ExperimentResult | ModelReport; choice?: AlgoChoice; onChoice?: (c: AlgoChoice) => void }) {
  const bestAp = Math.max(...report.evaluations.map((e) => e.ap))
  const rfmAp = report.evaluations.find((e) => e.algorithm === 'rfm')?.ap ?? 0
  return (
    <Card className="mt-6" title="Comparaison des algorithmes sur le jeu de test" subtitle="AUC-PR : métrique principale quand la cible est rare (0 à 1, le hasard vaut le taux de base). Entre crochets, l'intervalle de confiance à 95 %. Écart vs RFM : bootstrap apparié sur les mêmes donateurs ; significatif si l'intervalle est au-dessus de 0.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-stone-100">
            <tr>
              <Th>Algorithme</Th>
              <Th className="text-right">AUC-PR [IC 95 %]</Th>
              <Th className="text-right">Écart vs RFM [IC 95 %]</Th>
              <Th className="text-right">AUC-ROC [IC 95 %]</Th>
              <Th className="text-right">Précision@50</Th>
              <Th className="text-right">Lift top 10 %</Th>
              <Th className="text-right">Brier</Th>
              {onChoice && <Th className="text-right">Utilisé</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {report.evaluations.map((e) => (
              <tr key={e.algorithm} className={e.algorithm === 'rfm' ? 'bg-stone-50/60' : ''}>
                <Td>
                  <span className="flex items-center gap-2 font-medium text-stone-900">
                    <i className="size-2.5 rounded-full" style={{ background: ALGO_COLOR[e.algorithm] }} />
                    {ALGORITHM_LABELS[e.algorithm]}
                    {e.ap === bestAp && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Meilleur au test</Badge>}
                  </span>
                </Td>
                <Td className="text-right tabular-nums"><b>{fx(e.ap, 3)}</b> <span className="text-xs text-stone-400">[{ci(e.apCI)}]</span></Td>
                <Td className="text-right tabular-nums">
                  {e.apDiffVsRfmCI ? (
                    <span className={e.apDiffVsRfmCI[0] > 0 ? 'text-brand-700' : 'text-stone-500'}>
                      {e.ap - rfmAp >= 0 ? '+' : ''}{fx(e.ap - rfmAp, 3)} <span className="text-xs text-stone-400">[{fx(e.apDiffVsRfmCI[0], 3)} ; {fx(e.apDiffVsRfmCI[1], 3)}]</span>
                    </span>
                  ) : <span className="text-xs text-stone-400">—</span>}
                </Td>
                <Td className="text-right tabular-nums">{fx(e.auc, 3)} <span className="text-xs text-stone-400">[{ci(e.aucCI)}]</span></Td>
                <Td className="text-right tabular-nums">{formatPct(e.p50)}</Td>
                <Td className="text-right tabular-nums">{fx(e.top10.lift, 2)}×</Td>
                <Td className="text-right tabular-nums text-stone-500">{e.brier !== undefined ? fx(e.brier, 4) : '—'}</Td>
                {onChoice && (
                  <Td className="text-right">
                    {(('deployed' in report ? (report as ModelReport).deployed : report.selected) === e.algorithm) ? (
                      <CheckCircle2 className="ml-auto size-5 text-brand-600" />
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onChoice(e.algorithm as AlgoChoice)}>Utiliser</Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
        <span>Le meilleur modèle est choisi sur la validation. Il n'est utilisé que s'il bat la règle RFM sur le test (R1, R2) ; sinon Fidélia garde la règle RFM.</span>
        {onChoice && choice !== 'auto' && <button className="font-medium text-brand-600" onClick={() => onChoice('auto')}>Revenir au choix automatique</button>}
      </div>
    </Card>
  )
}

function Curves({ evaluations, selected, baseRate }: { evaluations: Evaluation[]; selected: Algorithm; baseRate: number }) {
  const [kind, setKind] = useState<'pr' | 'roc' | 'gain'>('pr')
  const meta = {
    pr: { title: 'Courbe précision-rappel', x: 'Rappel (part des cas trouvés)', y: 'Précision', ref: [{ x: 0, y: baseRate }, { x: 1, y: baseRate }] },
    roc: { title: 'Courbe ROC', x: 'Taux de faux positifs', y: 'Taux de vrais positifs', ref: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    gain: { title: 'Courbe de gain', x: 'Part des donateurs contactés', y: 'Part des cas captés', ref: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
  }[kind]
  return (
    <Card
      title={meta.title}
      subtitle={kind === 'gain' ? 'En contactant les x % mieux classés, quelle part des cas réels atteint-on ?' : kind === 'pr' ? 'Plus la courbe reste haute vers la droite, mieux c\'est. Pointillé : hasard.' : 'Plus la courbe monte vite à gauche, mieux le modèle sépare positifs et négatifs.'}
      action={
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs">
          <option value="pr">Précision-rappel</option>
          <option value="roc">ROC</option>
          <option value="gain">Gain</option>
        </select>
      }
    >
      <div className="h-80 p-4">
        <ResponsiveContainer>
          <LineChart margin={{ left: 0, right: 12, top: 8, bottom: 12 }}>
            <CartesianGrid stroke="#f0eeec" />
            <XAxis type="number" dataKey="x" domain={[0, 1]} tickFormatter={pctTick} {...axis} label={{ value: meta.x, position: 'insideBottom', offset: -6, fontSize: 11, fill: '#78716c' }} />
            <YAxis type="number" dataKey="y" domain={[0, kind === 'pr' ? 'auto' : 1]} tickFormatter={pctTick} {...axis} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v) * 100)} %`} labelFormatter={(v) => `${meta.x} : ${Math.round(Number(v) * 100)} %`} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line data={meta.ref} dataKey="y" name="Hasard" stroke="#d6d3d1" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            {evaluations.map((e) => (
              <Line key={e.algorithm} data={e[kind]} dataKey="y" name={ALGORITHM_LABELS[e.algorithm]} stroke={ALGO_COLOR[e.algorithm]} strokeWidth={e.algorithm === selected ? 2.5 : 1.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Importance({ report }: { report: ModelReport }) {
  const [algo, setAlgo] = useState<'logistic' | 'gbdt'>(report.selected === 'logistic' ? 'logistic' : 'gbdt')
  const items = (report.importance.find((i) => i.algorithm === algo)?.values ?? []).slice(0, 10)
  const max = Math.max(...items.map((i) => Math.abs(i.drop)), 0.001)
  const coef = new Map(FEATURE_KEYS.map((k, j) => [k, report.logistic.weights[j]]))
  return (
    <Card
      title="Variables les plus importantes"
      subtitle="Importance par permutation : de combien l'AUC baisse si l'on mélange la variable au hasard. Valable pour tout algorithme."
      action={
        <select value={algo} onChange={(e) => setAlgo(e.target.value as 'logistic' | 'gbdt')} className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs">
          <option value="logistic">Logistique</option>
          <option value="gbdt">Boosting</option>
        </select>
      }
    >
      <ul className="space-y-3 p-5">
        {items.map((i) => {
          const w = coef.get(i.feature as keyof Features) ?? 0
          return (
            <li key={i.feature}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-stone-800">{FEATURE_LABELS[i.feature as keyof Features]}</span>
                <span className="shrink-0 text-xs tabular-nums text-stone-500">
                  −{fx(i.drop, 3)} AUC{algo === 'logistic' && <span className={cx('ml-2 font-medium', w >= 0 ? 'text-rose-600' : 'text-sky-700')}>{w >= 0 ? '↑ augmente' : '↓ diminue'}</span>}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-stone-100">
                <div className="h-full rounded-full" style={{ width: `${(Math.max(0, i.drop) / max) * 100}%`, background: ALGO_COLOR[algo] }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Calibration({ evaluation, color }: { evaluation: Evaluation; color: string }) {
  const data = (evaluation.calibration ?? []).map((c) => ({ x: c.predicted, y: c.observed, n: c.n }))
  const max = Math.max(0.05, ...data.map((d) => Math.max(d.x, d.y))) * 1.1
  return (
    <Card title="Calibration" subtitle="Quand le modèle annonce 30 %, observe-t-on 30 % ? Chaque point est un décile du test ; il doit suivre la diagonale.">
      <div className="h-72 p-4">
        <ResponsiveContainer>
          <ScatterChart margin={{ left: 0, right: 12, top: 8, bottom: 12 }}>
            <CartesianGrid stroke="#f0eeec" />
            <XAxis type="number" dataKey="x" domain={[0, max]} tickFormatter={pctTick} {...axis} name="Prédit" label={{ value: 'Probabilité prédite', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#78716c' }} />
            <YAxis type="number" dataKey="y" domain={[0, max]} tickFormatter={pctTick} {...axis} width={44} name="Observé" />
            <ZAxis dataKey="n" range={[40, 160]} name="Exemples" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === 'Exemples' ? v : `${fx((Number(v) * 100), 1)} %`)} />
            <Scatter data={[{ x: 0, y: 0 }, { x: max, y: max }]} line={{ stroke: '#d6d3d1', strokeDasharray: '4 4' }} shape={() => <g />} isAnimationActive={false} />
            <Scatter data={data} fill={color} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Validation({ report }: { report: ModelReport }) {
  const sel = report.evaluations.find((e) => e.algorithm === report.selected)!
  return (
    <Card title="Réglage et robustesse" subtitle="Hyperparamètres essayés sur la validation, puis test temporel.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-100">
            <tr><Th>Essai</Th><Th>Réglage</Th><Th className="text-right">AUC-PR validation</Th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {report.hyper.validation.map((v, i) => (
              <tr key={i}>
                <Td className="text-stone-600">{ALGORITHM_LABELS[v.algorithm]}</Td>
                <Td className="text-stone-600">{v.setting}</Td>
                <Td className="text-right tabular-nums">{fx(v.ap, 3)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.temporal && (
        <div className="m-5 rounded-xl bg-stone-50 p-4 text-sm">
          <p className="font-medium text-stone-900">Test temporel</p>
          <p className="mt-1 text-stone-600">
            Entraîné sur les {report.temporal.trainPeriods} dates les plus anciennes, testé sur les {report.temporal.testPeriods} plus récentes ({report.temporal.nTest} exemples) :
            AUC <b>{fx(report.temporal.auc, 3)}</b> (test classique {fx(sel.auc, 3)}), AUC-PR <b>{fx(report.temporal.ap, 3)}</b>.
          </p>
        </div>
      )}
    </Card>
  )
}

function Fairness({ report }: { report: ExperimentResult }) {
  if (!report.fairness.length) return null
  return (
    <Card className="mt-6" title="Équité par sous-groupe" subtitle="Le modèle cible-t-il certains groupes plus que d'autres ? Ratio de sélection = part du groupe parmi les 20 % mieux scorés ÷ part du groupe dans la population. L'âge et la région ne sont jamais des variables du modèle.">
      <div className="grid grid-cols-1 gap-px bg-stone-100 xl:grid-cols-2">
        {report.fairness.map((f) => (
          <div key={f.by} className="min-w-0 overflow-x-auto bg-white p-5">
            <p className="mb-2 text-sm font-medium text-stone-900">{f.by === 'age' ? 'Tranche d\'âge' : 'Région'}</p>
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr><Th className="px-0">Groupe</Th><Th className="text-right">n</Th><Th className="text-right">Taux réel</Th><Th className="text-right">AUC</Th><Th className="text-right">Ratio sélection</Th></tr></thead>
              <tbody>
                {f.groups.map((g) => {
                  const flag = g.selectionRatio > 1.25 || g.selectionRatio < 0.8
                  return (
                    <tr key={g.group} className="border-t border-stone-100">
                      <Td className="px-0 text-stone-700">{g.group}</Td>
                      <Td className="text-right tabular-nums text-stone-500">{g.n}</Td>
                      <Td className="text-right tabular-nums">{fx((g.baseRate * 100), 1)} %</Td>
                      <Td className="text-right tabular-nums">{g.auc !== null ? fx(g.auc, 2) : '—'}</Td>
                      <Td className="text-right">
                        <span className={cx('inline-flex items-center gap-1 tabular-nums', flag ? 'font-semibold text-amber-700' : 'text-stone-700')}>
                          {flag && <AlertTriangle className="size-3.5" />}
                          {fx(g.selectionRatio, 2)}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
        Un écart n'est pas forcément injuste s'il reflète un vrai écart de comportement (comparer avec le taux réel). Il doit cependant être surveillé : sur-solliciter un groupe (par exemple les aînés) est un risque identifié. Garde-fous : plafond de sollicitation, validation humaine.
      </p>
    </Card>
  )
}

const RANGES: Record<keyof Features, { min: number; max: number; step: number; fmt: (v: number) => string }> = {
  recencyDays: { min: 0, max: 1200, step: 5, fmt: (v) => `${v} j` },
  gifts12m: { min: 0, max: 14, step: 1, fmt: (v) => `${v}` },
  amount12m: { min: 0, max: 2000, step: 10, fmt: (v) => `${v} $` },
  tenureMonths: { min: 0, max: 48, step: 1, fmt: (v) => `${v} mois` },
  failed90d: { min: 0, max: 3, step: 1, fmt: (v) => `${v}` },
  openRate3m: { min: 0, max: 0.8, step: 0.01, fmt: (v) => `${Math.round(v * 100)} %` },
  engagementTrend: { min: -0.4, max: 0.4, step: 0.01, fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts` },
  amountTrend: { min: -3, max: 3, step: 0.1, fmt: (v) => fx(v, 1) },
  giftsLifetime: { min: 0, max: 48, step: 1, fmt: (v) => `${v}` },
  avgGift: { min: 0, max: 500, step: 5, fmt: (v) => `${v} $` },
  lastGiftRatio: { min: -2, max: 2, step: 0.1, fmt: (v) => fx(v, 1) },
  anniversarySoon: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  emailOptOut: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  isAnnual: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  channelWeb: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  channelEvent: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  channelStreet: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
  seasonQ4: { min: 0, max: 1, step: 1, fmt: (v) => (v ? 'oui' : 'non') },
}

function Simulator({ report, kind }: { report: ModelReport; kind: ModelKind }) {
  const { scores } = useStore()
  const pool = useMemo(() => scores.filter((s) => (kind === 'churn' || kind === 'upgrade' ? s.segment === 'monthly' : kind === 'reactivation' ? s.segment === 'lapsed' : s.segment === 'one_time' || s.segment === 'annual')), [scores, kind])
  const [f, setF] = useState<Features | undefined>(() => pool[Math.floor(pool.length / 2)]?.features)
  if (!f) return null
  const x = toVector(f)
  const p = predictReport(report, x)
  const reasons = explain(report, x, f)

  return (
    <Card className="mt-6" title="Simulateur de prédiction" subtitle="Bougez les variables et observez la réaction du modèle en temps réel." action={
      <Button size="sm" variant="secondary" onClick={() => pool.length && setF(pool[Math.floor(Math.random() * pool.length)].features)}>
        <Shuffle className="size-3.5" /> Donateur au hasard
      </Button>
    }>
      <div className="grid grid-cols-1 gap-8 p-6 xl:grid-cols-[1fr_300px]">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((k) => (
            <label key={k} className="block">
              <div className="flex justify-between gap-2 text-[13px]">
                <span className="truncate text-stone-600">{FEATURE_LABELS[k]}</span>
                <span className="shrink-0 font-medium tabular-nums text-stone-900">{RANGES[k].fmt(f[k])}</span>
              </div>
              <input type="range" min={Math.min(RANGES[k].min, f[k])} max={Math.max(RANGES[k].max, f[k])} step={RANGES[k].step} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} className="w-full accent-brand-600" />
            </label>
          ))}
        </div>
        <div className="rounded-2xl bg-brand-900 p-6 text-white">
          <p className="text-sm text-brand-100/80">{MODEL_SPECS[kind].title}</p>
          <p className="mt-2 font-display text-6xl font-semibold tabular-nums">{Math.round(p * 100)}<span className="text-3xl"> %</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${p * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-brand-100/70">Moyenne observée : {formatPct(report.baseRate)} · {ALGORITHM_LABELS[report.deployed]}</p>
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-100/60">Ce qui fait monter le score</p>
            <ul className="mt-2 space-y-1.5 text-sm">{reasons.length ? reasons.map((r) => <li key={r.feature}>• {r.text}</li>) : <li className="text-brand-100/70">Rien de notable</li>}</ul>
          </div>
        </div>
      </div>
    </Card>
  )
}

type KddTask = ExperimentResult & { title: string; profit?: { cost: number; nTest: number; everyone: { mailed: number; net: number }; modelExpectedValue: { mailed: number; net: number }; rfmSameVolume: { mailed: number; net: number }; modelTop20: { mailed: number; net: number }; rfmTop20: { mailed: number; net: number } } }
const KDD_LABELS: Record<string, string> = {
  mois_depuis_dernier_don: 'Mois depuis le dernier don', nb_dons_total: 'Nombre de dons (total)', don_moyen: 'Don moyen', montant_total: 'Montant total',
  dernier_don: 'Dernier don', don_max: 'Don maximum', dernier_vs_moyen: 'Dernier don / don moyen', anciennete_mois: 'Ancienneté', taux_reponse_relances: 'Taux de réponse aux relances',
  taux_reponse_cartes: 'Taux de réponse aux cartes', relances_12_mois: 'Relances reçues (12 mois)', tendance_nb_dons_96_vs_95: 'Tendance du nombre de dons',
  tendance_montant_96_vs_95: 'Tendance des montants', delai_premier_second_don: 'Délai entre 1er et 2e don', code_frequence: 'Code de fréquence (RFA)', code_montant: 'Code de montant (RFA)',
}

function RealData() {
  const [task, setTask] = useState<'reactivation' | 'hausse'>('reactivation')
  const r = (kdd as unknown as Record<string, KddTask>)[task]
  const profit = (kdd as unknown as Record<string, KddTask>).reactivation.profit!
  const imp = r.importance.find((i) => i.algorithm === 'gbdt')!.values.slice(0, 8)
  const max = Math.max(...imp.map((i) => i.drop), 0.001)
  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-600 text-white"><Database className="size-5" /></span>
          <div className="text-sm text-stone-600">
            <h2 className="text-lg font-semibold text-stone-900">Validation sur de vrais donateurs : KDD Cup 1998</h2>
            <p className="mt-1">
              Jeu public (archive UCI) de <b>{kdd.n.toLocaleString('fr-CA')} donateurs inactifs</b> d'une organisation nationale de vétérans aux États-Unis, qui ont reçu une relance postale en juin 1997.
              On sait qui a répondu et combien il a donné. Mêmes algorithmes, même protocole, mêmes familles de variables que dans l'application (récence, fréquence, montant, tendance, engagement).
            </p>
            <p className="mt-2 text-xs text-stone-400">Pas de dons mensuels dans ce jeu : il valide la réactivation et la hausse du don, pas l'attrition du mensuel. Données non incluses dans le dépôt (script de téléchargement fourni).</p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Envoyer à tout le monde" value={formatMoney(profit.everyone.net)} hint={`profit net sur ${profit.everyone.mailed.toLocaleString('fr-CA')} envois (test), ${profit.cost} $US par envoi`} />
        <Stat label="Budget limité à 20 % : règle RFM" value={formatMoney(profit.rfmTop20.net)} hint={`${profit.rfmTop20.mailed.toLocaleString('fr-CA')} envois aux meilleurs scores RFM`} />
        <Stat label="Budget limité à 20 % : modèle" value={formatMoney(profit.modelTop20.net)} hint={`+${Math.round((profit.modelTop20.net / profit.rfmTop20.net - 1) * 100)} % vs RFM, avec 5 fois moins d'envois que « tout le monde »`} tone="good" />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Honnêtement : à gros volume ({profit.modelExpectedValue.mailed.toLocaleString('fr-CA')} envois), le modèle ({formatMoney(profit.modelExpectedValue.net)}) et la règle RFM ({formatMoney(profit.rfmSameVolume.net)}) font jeu égal. L'avantage du modèle est de bien classer les premiers noms, ce qui compte pour une petite équipe. Montants en dollars américains de 1997.
      </p>

      <div className="mt-6">
        <Tabs<'reactivation' | 'hausse'> value={task} onChange={setTask} items={[{ value: 'reactivation', label: 'Réactivation' }, { value: 'hausse', label: 'Hausse du don' }]} />
      </div>
      <p className="mt-3 text-sm text-stone-600">{r.title} · taux de base {formatPct(r.baseRate)} · {r.nTrain.toLocaleString('fr-CA')} / {r.nVal.toLocaleString('fr-CA')} / {r.nTest.toLocaleString('fr-CA')} exemples</p>
      <Comparison report={r} />
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Curves evaluations={r.evaluations} selected={r.selected} baseRate={r.baseRate} />
        <Card title="Variables les plus importantes" subtitle="Importance par permutation (boosting).">
          <ul className="space-y-3 p-5">
            {imp.map((i) => (
              <li key={i.feature}>
                <div className="flex justify-between text-sm"><span className="text-stone-800">{KDD_LABELS[i.feature] ?? i.feature}</span><span className="text-xs tabular-nums text-stone-500">−{fx(i.drop, 3)} AUC</span></div>
                <div className="mt-1.5 h-2 rounded-full bg-stone-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${(Math.max(0, i.drop) / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {r.learningCurve && (
        <Card className="mt-6" title="Courbe d'apprentissage" subtitle="Performance au test selon la quantité de données d'entraînement : combien de donateurs faut-il pour bien apprendre ?">
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <LineChart data={r.learningCurve} margin={{ left: 0, right: 12, top: 8, bottom: 12 }}>
                <CartesianGrid stroke="#f0eeec" />
                <XAxis dataKey="n" {...axis} tickFormatter={(v) => `${Math.round(v / 1000)} k`} label={{ value: "Donateurs à l'entraînement", position: 'insideBottom', offset: -6, fontSize: 11, fill: '#78716c' }} />
                <YAxis {...axis} width={50} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fx(Number(v), 4)} />
                <Line dataKey="ap" name="AUC-PR" stroke="#1f7a4d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Fairness report={r} />
    </>
  )
}
