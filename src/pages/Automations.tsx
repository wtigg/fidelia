import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Play } from 'lucide-react'
import { Button, Card, PageHeader, Toggle } from '../components/ui.tsx'
import { formatEur } from '../lib/dates.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS } from '../lib/labels.ts'
import type { ActionType, Segment } from '../lib/types.ts'
import { useStore } from '../state/store.tsx'

const SEGMENT_FOR: Record<ActionType, Segment> = {
  churn_prevention: 'monthly',
  upgrade_one_time: 'one_time',
  upgrade_annual: 'annual',
  reactivation: 'lapsed',
}

export default function Automations() {
  const { automations, setAutomation, scores, runCycle, training } = useStore()
  const [result, setResult] = useState<{ drafted: number; sent: number }>()

  const stats = useMemo(() => {
    const out = {} as Record<ActionType, { count: number; value: number; pool: number }>
    for (const a of automations) {
      const pool = scores.filter((s) => s.segment === SEGMENT_FOR[a.type])
      const hit = pool.filter((s) => s.actionProb >= a.threshold)
      out[a.type] = { count: hit.length, value: hit.reduce((s, x) => s + x.expectedValue, 0), pool: pool.length }
    }
    return out
  }, [automations, scores])

  return (
    <>
      <PageHeader
        title="Automatisations"
        subtitle="Choisissez à partir de quelle probabilité le modèle déclenche une action, et si un humain doit valider l'email avant envoi."
        actions={
          <Button variant="primary" disabled={training} onClick={() => setResult(runCycle())}>
            <Play className="size-4" /> Lancer le cycle maintenant
          </Button>
        }
      />

      {result && (
        <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Cycle terminé : <b>{result.drafted}</b> email{result.drafted > 1 ? 's' : ''} en attente de validation, <b>{result.sent}</b> envoyé{result.sent > 1 ? 's' : ''} automatiquement (simulé).{' '}
          <Link to="/campagnes" className="font-medium underline">Voir les emails</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {automations.map((a) => {
          const s = stats[a.type]
          return (
            <Card key={a.type} className={a.enabled ? '' : 'opacity-70'}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="mt-1 h-10 w-1 rounded-full" style={{ background: ACTION_COLOR[a.type] }} />
                    <div>
                      <h2 className="font-semibold text-stone-900">{ACTION_LABELS[a.type]}</h2>
                      <p className="mt-0.5 text-sm text-stone-500">{ACTION_DESCRIPTIONS[a.type]}</p>
                    </div>
                  </div>
                  <Toggle checked={a.enabled} onChange={(v) => setAutomation(a.type, { enabled: v })} label="Activer" />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Seuil de probabilité</span>
                    <span className="font-semibold tabular-nums text-stone-900">{Math.round(a.threshold * 100)} %</span>
                  </div>
                  <input
                    type="range"
                    min={0.02}
                    max={0.7}
                    step={0.01}
                    value={a.threshold}
                    disabled={!a.enabled}
                    onChange={(e) => setAutomation(a.type, { threshold: Number(e.target.value) })}
                    className="mt-2 w-full"
                    style={{ accentColor: ACTION_COLOR[a.type] }}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Donateurs ciblés</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">
                        {s.count} <span className="text-sm font-normal text-stone-400">/ {s.pool}</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Valeur attendue</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">{formatEur(s.value)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-stone-400">Seuil bas : plus de donateurs touchés mais moins ciblés. Seuil haut : moins d'emails, plus pertinents.</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-stone-800">Validation humaine</p>
                    <p className="text-xs text-stone-500">{a.requireApproval ? 'Les emails attendent votre accord' : 'Les emails partent automatiquement'}</p>
                  </div>
                  <Toggle checked={a.requireApproval} onChange={(v) => setAutomation(a.type, { requireApproval: v })} label="Validation humaine" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <p>
          En production, ce cycle tourne chaque nuit : import des nouveaux dons, recalcul des scores, préparation des emails. Un donateur ne reçoit jamais
          deux emails en parallèle, et les donateurs sans consentement email sont exclus de l'envoi.
        </p>
      </div>
    </>
  )
}
