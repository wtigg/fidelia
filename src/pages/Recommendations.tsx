import { donorsForAction } from '../lib/actionStats.ts'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Mail, MailX, SlidersHorizontal, Sparkles } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { Badge, Button, Card, Empty, PageHeader, ProbBar, Tabs, Td, Th } from '../components/ui.tsx'
import { formatMoney } from '../lib/dates.ts'
import { ACTION_COLOR, ACTION_DESCRIPTIONS, ACTION_LABELS, ACTION_TONE, ACTION_TYPES, PROB_WORD, SEGMENT_LABELS, thresholdText } from '../lib/labels.ts'
import type { ActionType } from '../lib/types.ts'
import { useStore } from '../state/store.tsx'

type Filter = 'all' | ActionType
const TYPES = ACTION_TYPES
const PAGE = 40

export default function Recommendations() {
  const { scores, donorsById, campaign, createDrafts, automations, training } = useStore()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('type') as Filter) ?? 'all'
  const [sort, setSort] = useState<'value' | 'prob'>('value')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)
  const [toast, setToast] = useState<string>()

  const inCampaign = useMemo(() => new Map(campaign.filter((c) => c.status !== 'dismissed').map((c) => [c.donorId, c.status])), [campaign])
  const all = useMemo(() => scores.filter((s) => s.action), [scores])
  const list = useMemo(() => {
    const l = all.filter((s) => filter === 'all' || s.action === filter)
    return sort === 'prob' ? [...l].sort((a, b) => b.actionProb - a.actionProb) : l
  }, [all, filter, sort])
  const shown = list.slice(0, limit)
  const actionable = list.filter((s) => !inCampaign.has(s.donorId) && donorsById.get(s.donorId)?.emailConsent)

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const prepare = (ids: string[]) => {
    const { drafted: n, control } = createDrafts(ids)
    setSelected(new Set())
    const ctrl = control ? ` · ${control} mis de côté pour mesurer l'effet` : ''
    setToast(n || control ? `${n} courriel${n > 1 ? 's' : ''} préparé${n > 1 ? 's' : ''} dans l'onglet Courriels${ctrl}` : 'Aucun nouveau courriel à préparer')
    setTimeout(() => setToast(undefined), 3500)
  }

  // ?fiche=auto (visite guidée) : ouvre la fiche du premier donateur, de préférence avec un paiement échoué
  const fiche = params.get('fiche')
  const autoFiche = fiche === 'auto' ? (list.find((s) => s.features.failed90d > 0) ?? list[0])?.donorId ?? null : fiche
  const drawerId = open ?? autoFiche
  const closeDrawer = () => {
    setOpen(null)
    if (fiche) {
      const next = new URLSearchParams(params)
      next.delete('fiche')
      setParams(next)
    }
  }

  const auto = filter !== 'all' ? automations.find((a) => a.type === filter) : undefined
  const changeFilter = (v: Filter) => {
    setParams(v === 'all' ? {} : { type: v })
    setLimit(PAGE)
    setSelected(new Set())
  }
  const filterItems: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'Toutes', count: all.length },
    ...TYPES.map((t) => ({ value: t as Filter, label: ACTION_LABELS[t], count: donorsForAction(all, t).length })),
  ]

  return (
    <>
      <PageHeader
        title="Recommandations"
        subtitle="Qui relancer, à qui proposer le mensuel, qui solliciter davantage, qui remercier. Classés par dollars à gagner."
        actions={
          <>
            <Link to="/automatisations">
              <Button variant="secondary"><SlidersHorizontal className="size-4" /> Régler les listes</Button>
            </Link>
            <Button variant="primary" disabled={!actionable.length} onClick={() => prepare(selected.size ? [...selected] : actionable.map((s) => s.donorId))}>
              <Mail className="size-4" />
              {selected.size ? `Préparer ${selected.size} courriel${selected.size > 1 ? 's' : ''}` : `Préparer tous les courriels (${actionable.length})`}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="hidden sm:block">
          <Tabs<Filter> value={filter} onChange={changeFilter} items={filterItems} />
        </div>
        {/* sur téléphone : une liste déroulante plutôt que sept onglets sur quatre lignes */}
        <label className="flex items-center gap-2 text-sm text-stone-500 sm:hidden">
          Afficher
          <select value={filter} onChange={(e) => changeFilter(e.target.value as Filter)} className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-800">
            {filterItems.map((it) => (
              <option key={it.value} value={it.value}>{it.label} ({it.count})</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-sm text-stone-500">
          Trier par
          <select value={sort} onChange={(e) => setSort(e.target.value as 'value' | 'prob')} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-800">
            <option value="value">Dons espérés sur un an</option>
            <option value="prob">Chance ou risque le plus élevé</option>
          </select>
        </div>
      </div>

      {filter !== 'all' && (
        <p className="mb-4 text-sm text-stone-500">
          {ACTION_DESCRIPTIONS[filter]} {filter !== 'thank' && <>Fidélia retient les donateurs dont {PROB_WORD(filter) === 'risque' ? 'le risque' : 'la chance'} atteint <b className="text-stone-700">{thresholdText(auto?.threshold ?? 0)}</b>.</>}
        </p>
      )}

      <Card>
        {training && !all.length ? (
          <Empty icon={<Sparkles className="size-5" />} title="Le modèle s'entraîne…">Les recommandations apparaissent dans un instant.</Empty>
        ) : !list.length ? (
          <Empty icon={<Check className="size-5" />} title="Rien à faire ici">Aucun donateur n'atteint le niveau choisi pour cette action.</Empty>
        ) : (
          <>
          <ul className="divide-y divide-stone-100 sm:hidden">
            {shown.map((s) => {
              const d = donorsById.get(s.donorId)!
              const status = inCampaign.get(s.donorId)
              const reason = s.action === 'thank' ? s.thankReason : s.reasons[0]?.text
              return (
                <li key={s.donorId} className="p-4">
                  <button className="block w-full text-left" onClick={() => setOpen(s.donorId)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-stone-900">{d.firstName} {d.lastName}</p>
                      <p className="shrink-0 text-right font-semibold tabular-nums text-stone-900">
                        {s.action === 'thank' ? '' : formatMoney(s.expectedValue)}
                        {s.action !== 'thank' && <span className="block text-[11px] font-normal text-stone-500">espérés sur un an</span>}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge>
                      {s.action !== 'thank' && <span className="text-xs text-stone-500">{Math.round(s.actionProb * 100)} % {PROB_WORD(s.action)}</span>}
                    </div>
                    {reason && <p className="mt-1.5 truncate text-sm text-stone-600">{reason}</p>}
                  </button>
                  <div className="mt-3">
                    {status ? (
                      <Badge className="bg-brand-50 text-brand-700 ring-brand-100"><Check className="size-3" />{status === 'sent' ? 'Envoyé' : 'Préparé'}</Badge>
                    ) : !d.emailConsent ? (
                      <Badge><MailX className="size-3" />Sans consentement courriel</Badge>
                    ) : (
                      <Button size="md" variant="secondary" className="w-full" onClick={() => prepare([s.donorId])}>
                        <Mail className="size-4" /> Préparer le courriel
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-stone-100">
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={selected.size > 0 && shown.every((s) => selected.has(s.donorId) || inCampaign.has(s.donorId))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(shown.filter((s) => !inCampaign.has(s.donorId) && donorsById.get(s.donorId)?.emailConsent).map((s) => s.donorId)) : new Set())}
                    />
                  </Th>
                  <Th>Donateur</Th>
                  <Th>Action</Th>
                  <Th>Chance ou risque</Th>
                  <Th>Pourquoi</Th>
                  <Th className="whitespace-nowrap text-right">Dons espérés (1 an)</Th>
                  <Th className="text-right">Statut</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shown.map((s) => {
                  const d = donorsById.get(s.donorId)!
                  const status = inCampaign.get(s.donorId)
                  return (
                    <tr key={s.donorId} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpen(s.donorId)}>
                      <Td>
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          disabled={!!status || !d.emailConsent}
                          checked={selected.has(s.donorId)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggle(s.donorId)}
                        />
                      </Td>
                      <Td>
                        <p className="whitespace-nowrap font-medium text-stone-900">{d.firstName} {d.lastName}</p>
                        <p className="text-xs text-stone-500">
                          {SEGMENT_LABELS[s.segment]}
                          {d.monthlyAmount && s.segment === 'monthly' ? ` · ${d.monthlyAmount} $/mois` : ''}
                          {s.suggestedMonthly && s.action !== 'thank' && s.action !== 'churn_prevention' && s.action !== 'reactivation' ? ` · suggérer ${s.suggestedMonthly} $/mois` : ''}
                        </p>
                      </Td>
                      <Td><Badge className={ACTION_TONE[s.action!]}>{ACTION_LABELS[s.action!]}</Badge></Td>
                      <Td>{s.action === 'thank' ? <span className="text-xs text-stone-500">Toujours</span> : <ProbBar value={s.actionProb} color={ACTION_COLOR[s.action!]} width="w-14" word={PROB_WORD(s.action)} />}</Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          {s.action === 'thank' && <span className="whitespace-nowrap rounded-md bg-pink-50 px-1.5 py-0.5 text-xs text-pink-700">{s.thankReason}</span>}
                          {s.action !== 'thank' && s.reasons.slice(0, 2).map((r) => (
                            <span key={r.feature} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{r.text}</span>
                          ))}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold tabular-nums text-stone-900">{s.action === 'thank' ? '—' : formatMoney(s.expectedValue)}</Td>
                      <Td className="text-right">
                        {status ? (
                          <Badge className="bg-brand-50 text-brand-700 ring-brand-100"><Check className="size-3" />{status === 'sent' ? 'Envoyé' : 'Préparé'}</Badge>
                        ) : !d.emailConsent ? (
                          <Badge><MailX className="size-3" />Sans consentement</Badge>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); prepare([s.donorId]) }}>
                            <Mail className="size-3.5" /> Préparer
                          </Button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {list.length > limit && (
          <div className="border-t border-stone-100 p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({list.length - limit} restants)</Button>
          </div>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast} · <Link to="/campagnes" className="font-medium text-gold underline">Ouvrir</Link>
        </div>
      )}
      <DonorDrawer donorId={drawerId} onClose={closeDrawer} />
    </>
  )
}
