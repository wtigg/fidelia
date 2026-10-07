import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Mail, MailX, MapPin, Sparkles } from 'lucide-react'
import { addMonths, formatDate, formatMoney, iso, monthIndex, fx } from '../lib/dates.ts'
import { ACTION_COLOR, ACTION_LABELS, ACTION_TONE, PROB_LABEL, SEGMENT_LABELS, SEGMENT_TONE } from '../lib/labels.ts'
import type { ModelKind } from '../lib/types.ts'
import { FEATURE_KEYS, FEATURE_LABELS } from '../ml/features.ts'
import type { Features } from '../lib/types.ts'
import { ALGORITHM_LABELS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'
import { Badge, Button, Card, Drawer, ProbBar } from './ui.tsx'

function formatFeature(k: keyof Features, v: number): string {
  if (k === 'amount12m' || k === 'avgGift') return formatMoney(v)
  if (k === 'openRate3m') return `${Math.round(v * 100)} %`
  if (k === 'engagementTrend') return `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts`
  if (k === 'amountTrend' || k === 'lastGiftRatio') return `${v > 0 ? '+' : ''}${fx(v, 2)}`
  if (['anniversarySoon', 'emailOptOut', 'isAnnual', 'channelWeb', 'channelEvent', 'channelStreet', 'seasonQ4'].includes(k)) return v ? 'oui' : 'non'
  return String(v)
}

const monthFmt = new Intl.DateTimeFormat('fr-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' })

export function DonorDrawer({ donorId, onClose }: { donorId: string | null; onClose: () => void }) {
  const { donorsById, scoresById, dataset, reports, campaign, createDrafts } = useStore()
  const donor = donorId ? donorsById.get(donorId) : undefined
  const score = donorId ? scoresById.get(donorId) : undefined

  const history = useMemo(() => {
    if (!donor) return []
    const start = new Date(dataset.historyStart)
    const months = monthIndex(new Date(dataset.refDate), start)
    const rows = Array.from({ length: months }, (_, m) => ({
      label: monthFmt.format(addMonths(start, m)),
      paid: 0,
      failed: 0,
      open: donor.engagement[m] >= 0 ? Math.round(donor.engagement[m] * 100) : null,
    }))
    for (const g of dataset.donations) {
      if (g.donorId !== donor.id) continue
      const m = monthIndex(new Date(g.date), start)
      if (m < 0 || m >= months) continue
      if (g.status === 'paid') rows[m].paid += g.amount
      else rows[m].failed += g.amount
    }
    return rows.slice(-24)
  }, [donor, dataset])

  if (!donor || !score) return null
  const kind: ModelKind =
    score.segment === 'monthly'
      ? score.action === 'upgrade_amount' || (score.action !== 'churn_prevention' && (score.upgradeProb ?? 0) > (score.churnProb ?? 0)) ? 'upgrade' : 'churn'
      : score.segment === 'lapsed' ? 'reactivation' : 'conversion'
  const others: [ModelKind, number | undefined][] = score.segment === 'monthly' ? [['churn', score.churnProb], ['upgrade', score.upgradeProb]] : []
  const report = reports[kind]
  const inCampaign = campaign.find((c) => c.donorId === donor.id && c.status !== 'dismissed')
  const color = score.action ? ACTION_COLOR[score.action] : '#78716c'
  const maxImpact = Math.max(0.01, ...score.reasons.map((r) => r.impact))

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <div>
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-stone-900">
              {donor.firstName} {donor.lastName}
            </h2>
            <Badge className={SEGMENT_TONE[score.segment]}>{SEGMENT_LABELS[score.segment]}</Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-stone-500">
            <span>{donor.email}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {donor.city}
            </span>
            <span>Donateur depuis {formatDate(donor.joinDate)}</span>
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        <Card>
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">{PROB_LABEL[kind]}</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums" style={{ color }}>
                  {Math.round(score.actionProb * 100)} %
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {report ? `${ALGORITHM_LABELS[report.deployed]} · horizon ${kind === 'churn' ? '90 jours' : '6 mois'}` : 'Modèle indisponible'}
                </p>
                {others.filter(([k]) => k !== kind).map(([k, p]) => (
                  <p key={k} className="mt-2 text-xs text-stone-500">{PROB_LABEL[k]} : <b className="tabular-nums text-stone-700">{Math.round((p ?? 0) * 100)} %</b></p>
                ))}
              </div>
              <div className="text-right">
                {score.action ? (
                  <Badge className={ACTION_TONE[score.action]}>
                    <Sparkles className="size-3" />
                    {ACTION_LABELS[score.action]}
                  </Badge>
                ) : (
                  <Badge>Aucune action recommandée</Badge>
                )}
                <p className="mt-2 text-sm text-stone-500">
                  Valeur attendue <span className="font-semibold text-stone-900">{formatMoney(score.expectedValue)}</span>/an
                </p>
                {score.thankReason && <p className="mt-2 text-sm text-pink-700">À remercier : {score.thankReason}</p>}
                {score.suggestedMonthly && score.action !== 'churn_prevention' && score.action !== 'reactivation' && (
                  <p className="text-sm text-stone-500">
                    Montant mensuel suggéré <span className="font-semibold text-stone-900">{score.suggestedMonthly} $</span>
                  </p>
                )}
              </div>
            </div>
            {score.action && (
              <div className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-4">
                {inCampaign ? (
                  <p className="flex items-center gap-1.5 text-sm text-brand-700">
                    <Check className="size-4" /> Courriel {inCampaign.status === 'sent' ? 'envoyé' : inCampaign.status === 'control' ? 'non envoyé (groupe témoin)' : 'en préparation'}
                  </p>
                ) : donor.emailConsent ? (
                  <Button variant="primary" size="sm" onClick={() => createDrafts([donor.id])}>
                    <Mail className="size-4" /> Préparer le courriel
                  </Button>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-stone-500">
                    <MailX className="size-4" /> Pas de consentement courriel : à contacter par téléphone ou par la poste
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Pourquoi cette prédiction ?" subtitle="Variables qui poussent le plus la probabilité vers le haut pour ce donateur">
          <div className="space-y-3 p-5">
            {score.reasons.length ? (
              score.reasons.map((r) => (
                <div key={r.feature}>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-800">{r.text}</span>
                    <span className="text-xs text-stone-400">{FEATURE_LABELS[r.feature]}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-stone-100">
                    <div className="h-full rounded-full" style={{ width: `${(r.impact / maxImpact) * 100}%`, background: color }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">Aucun signal ne se détache : profil proche de la moyenne.</p>
            )}
          </div>
        </Card>

        <Card title="Historique sur 24 mois" subtitle="Dons (barres) et taux d'ouverture des courriels (courbe)">
          <div className="h-56 px-2 py-4">
            <ResponsiveContainer>
              <ComposedChart data={history} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#f0eeec" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis yAxisId="eur" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={40} unit="$" />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                  formatter={(v, name) => [name === 'open' ? `${v} %` : `${v} $`, name === 'paid' ? 'Don' : name === 'failed' ? 'Échec de paiement' : 'Ouverture des courriels']}
                />
                <Bar yAxisId="eur" dataKey="paid" stackId="a" fill="#1f7a4d" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="eur" dataKey="failed" stackId="a" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                <Line yAxisId="pct" dataKey="open" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Variables vues par le modèle" subtitle={`Calculées au ${formatDate(dataset.refDate)} à partir des données passées uniquement`}>
          <dl className="grid grid-cols-2 gap-px bg-stone-100 text-sm">
            {FEATURE_KEYS.map((k) => (
              <div key={k} className="bg-white px-5 py-3">
                <dt className="text-xs text-stone-400">{FEATURE_LABELS[k]}</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-stone-800">{formatFeature(k, score.features[k])}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Profil">
          <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
            <div>
              <dt className="text-stone-400">Type de don</dt>
              <dd className="text-stone-800">{donor.kind === 'monthly' ? `Mensuel${donor.monthlyAmount ? ` · ${donor.monthlyAmount} $` : ''}` : donor.kind === 'annual' ? 'Annuel' : 'Ponctuel'}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Canal d'acquisition</dt>
              <dd className="text-stone-800">{donor.channel === 'rue' ? 'Rue (face-à-face)' : donor.channel === 'evenement' ? 'Événement' : donor.channel === 'courrier' ? 'Courrier' : donor.channel === 'web' ? 'En ligne' : 'Inconnu'}</dd>
            </div>
            <div>
              <dt className="text-stone-400">Consentement courriel</dt>
              <dd className="text-stone-800">{donor.emailConsent ? 'Oui' : 'Non'}</dd>
            </div>
            {donor.convertedAt && (
              <div>
                <dt className="text-stone-400">Passé au mensuel</dt>
                <dd className="text-stone-800">{formatDate(donor.convertedAt)}</dd>
              </div>
            )}
            {donor.churnDate && (
              <div>
                <dt className="text-stone-400">Arrêt du don mensuel</dt>
                <dd className="text-stone-800">{formatDate(donor.churnDate)}</dd>
              </div>
            )}
            <div>
              <dt className="text-stone-400">Probabilité</dt>
              <dd>
                <ProbBar value={score.actionProb} color={color} />
              </dd>
            </div>
            <div>
              <dt className="text-stone-400">Date d'analyse</dt>
              <dd className="text-stone-800">{iso(new Date(dataset.refDate))}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </Drawer>
  )
}
