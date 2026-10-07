import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { Badge, Button, Card, PageHeader, ProbBar, Tabs, Td, Th } from '../components/ui.tsx'
import { formatMoney } from '../lib/dates.ts'
import { ACTION_LABELS, ACTION_TONE, SEGMENT_LABELS, SEGMENT_TONE } from '../lib/labels.ts'
import type { Segment } from '../lib/types.ts'
import { useStore } from '../state/store.tsx'

const PAGE = 50
type Filter = 'all' | Segment

export default function Donors() {
  const { scores, donorsById } = useStore()
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return scores
      .filter((s) => seg === 'all' || s.segment === seg)
      .filter((s) => {
        if (!query) return true
        const d = donorsById.get(s.donorId)!
        return `${d.firstName} ${d.lastName} ${d.email} ${d.city}`.toLowerCase().includes(query)
      })
      .sort((a, b) => donorsById.get(a.donorId)!.lastName.localeCompare(donorsById.get(b.donorId)!.lastName))
  }, [scores, donorsById, q, seg])

  const count = (s: Segment) => scores.filter((x) => x.segment === s).length

  return (
    <>
      <PageHeader title="Donateurs" subtitle="Toute votre base, avec le score calculé par le modèle pour chaque donateur." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<Filter>
          value={seg}
          onChange={(v) => { setSeg(v); setLimit(PAGE) }}
          items={[
            { value: 'all', label: 'Tous', count: scores.length },
            ...(['monthly', 'one_time', 'annual', 'lapsed'] as Segment[]).map((s) => ({ value: s, label: SEGMENT_LABELS[s], count: count(s) })),
          ]}
        />
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
            placeholder="Nom, email, ville…"
            className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 lg:w-72"
          />
        </label>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-stone-100">
              <tr>
                <Th>Donateur</Th>
                <Th>Segment</Th>
                <Th className="text-right">Donné (12 mois)</Th>
                <Th className="text-right">Dernier don</Th>
                <Th className="text-right">Ouverture emails</Th>
                <Th>Score du modèle</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.slice(0, limit).map((s) => {
                const d = donorsById.get(s.donorId)!
                const color = s.segment === 'monthly' ? '#e11d48' : s.segment === 'lapsed' ? '#d97706' : '#1f7a4d'
                return (
                  <tr key={s.donorId} className="cursor-pointer hover:bg-stone-50" onClick={() => setOpen(s.donorId)}>
                    <Td>
                      <p className="font-medium text-stone-900">{d.firstName} {d.lastName}</p>
                      <p className="text-xs text-stone-500">{d.city}</p>
                    </Td>
                    <Td><Badge className={SEGMENT_TONE[s.segment]}>{SEGMENT_LABELS[s.segment]}</Badge></Td>
                    <Td className="text-right tabular-nums">{formatMoney(s.features.amount12m)}</Td>
                    <Td className="text-right tabular-nums text-stone-600">il y a {s.features.recencyDays} j</Td>
                    <Td className="text-right tabular-nums text-stone-600">{Math.round(s.features.openRate3m * 100)} %</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ProbBar value={s.actionProb} color={color} width="w-16" />
                        <span className="text-xs text-stone-400">{s.segment === 'monthly' ? 'churn' : s.segment === 'lapsed' ? 'retour' : 'conversion'}</span>
                      </div>
                    </Td>
                    <Td>{s.action ? <Badge className={ACTION_TONE[s.action]}>{ACTION_LABELS[s.action]}</Badge> : <span className="text-xs text-stone-400">—</span>}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {list.length > limit && (
          <div className="border-t border-stone-100 p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({list.length - limit} restants)</Button>
          </div>
        )}
        {!list.length && <p className="px-5 py-12 text-center text-sm text-stone-500">Aucun donateur trouvé.</p>}
      </Card>
      <DonorDrawer donorId={open} onClose={() => setOpen(null)} />
    </>
  )
}
