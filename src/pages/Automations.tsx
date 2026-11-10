import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Play } from 'lucide-react'
import { Button, Card, PageHeader, Toggle } from '../components/ui.tsx'
import { actionStats } from '../lib/actionStats.ts'
import { formatMoney } from '../lib/dates.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS, PROB_WORD, thresholdText } from '../lib/labels.ts'
import type { ActionType, DonorScore } from '../lib/types.ts'
import { CONTACT_COOLDOWN_DAYS, CONTROL_SHARE, useStore } from '../state/store.tsx'

const probFor = (type: ActionType, s: DonorScore): number | undefined => {
  if (type === 'churn_prevention') return s.churnProb
  if (type === 'upgrade_amount') return s.upgradeProb
  if (type === 'upgrade_one_time') return s.segment === 'one_time' ? s.conversionProb : undefined
  if (type === 'upgrade_annual') return s.segment === 'annual' ? s.conversionProb : undefined
  if (type === 'reactivation') return s.reactivationProb
  return undefined
}

export default function Automations() {
  const { automations, setAutomation, scores, runCycle, training } = useStore()
  const [result, setResult] = useState<{ drafted: number; sent: number; skipped: number; control: number }>()

  const stats = useMemo(() => {
    const out = {} as Record<ActionType, { count: number; value: number; pool: number }>
    for (const a of automations) {
      // même définition que le tableau de bord : l'action finale retenue pour chaque donateur
      const { count, value } = actionStats(scores, a.type)
      const pool = a.type === 'thank' ? scores.length : scores.filter((s) => probFor(a.type, s) !== undefined).length
      out[a.type] = { count, value, pool }
    }
    return out
  }, [automations, scores])

  return (
    <>
      <PageHeader
        title="Automatisations"
        subtitle="Choisissez à partir de quelle chance (ou quel risque) Fidélia ajoute un donateur à une liste. Curseur à gauche : plus de donateurs, moins ciblés. À droite : moins de courriels, plus pertinents."
        actions={
          <Button variant="primary" disabled={training} onClick={() => setResult(runCycle())}>
            <Play className="size-4" /> Lancer le cycle maintenant
          </Button>
        }
      />

      {result && (
        <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Cycle terminé : <b>{result.drafted}</b> courriel{result.drafted > 1 ? 's' : ''} en attente de validation, <b>{result.sent}</b> envoyé{result.sent > 1 ? 's' : ''} automatiquement (simulé),{' '}
          <b>{result.control}</b> donateur{result.control > 1 ? 's' : ''} mis de côté pour mesurer l'effet (10 %), {result.skipped} ignoré{result.skipped > 1 ? 's' : ''} (déjà contacté{result.skipped > 1 ? 's' : ''} il y a moins de {CONTACT_COOLDOWN_DAYS} jours).{' '}
          <Link to="/campagnes" className="font-medium underline">Voir les courriels</Link>
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

                {a.type === 'thank' ? (
                  <div className="mt-6 rounded-xl bg-stone-50 p-3">
                    <p className="text-xs text-stone-500">Donateurs à remercier aujourd'hui</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">{s.count}</p>
                    <p className="mt-1 text-xs text-stone-500">Règle simple, sans IA : premier don, don inhabituel (≥ 250 $ et ≥ 2 fois la moyenne) ou anniversaire du don mensuel. Une règle suffit ici : pas besoin d'un modèle.</p>
                  </div>
                ) : (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">{PROB_WORD(a.type) === 'risque' ? 'Risque minimal' : 'Chance minimale'}</span>
                    <span className="font-semibold tabular-nums text-stone-900">{thresholdText(a.threshold)}</span>
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
                    style={{ '--range': ACTION_COLOR[a.type] } as CSSProperties}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Donateurs ciblés</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">
                        {s.count} <span className="text-sm font-normal text-stone-400">/ {s.pool}</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Dons espérés sur un an</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">{formatMoney(s.value)}</p>
                    </div>
                  </div>
                </div>

                )}
                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-stone-800">Validation humaine</p>
                    <p className="text-xs text-stone-500">{a.requireApproval ? 'Les courriels attendent votre accord' : 'Les courriels partent automatiquement (déconseillé)'}</p>
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
          En production, ce cycle tourne chaque semaine : import des nouveaux dons, mise à jour des listes, préparation des courriels. Garde-fous :
          un courriel au plus tous les {CONTACT_COOLDOWN_DAYS} jours par donateur, remerciement avant toute sollicitation, exclusion des donateurs sans consentement,
          et {Math.round(CONTROL_SHARE * 100)} % des donateurs ciblés mis de côté, sans contact, pour mesurer l'effet réel des actions.
        </p>
      </div>
    </>
  )
}
