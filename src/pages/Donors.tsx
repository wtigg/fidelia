import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { DonorDrawer } from '../components/DonorDrawer.tsx'
import { Badge, Button, Card, PageHeader, ProbBar, Tabs, Td, Th } from '../components/ui.tsx'
import { formatMoney } from '../lib/dates.ts'
import { ACTION_LABELS, ACTION_TONE, SEGMENT_HELP, SEGMENT_LABELS, SEGMENT_TONE } from '../lib/labels.ts'
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
  // Par défaut : par priorité (dons espérés sur un an, comme les recommandations). Le tri par nom alignait 50 « Beaulieu » d'affilée.
  const [sort, setSort] = useState<'priority' | 'name' | 'recent'>('priority')

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return scores
      .filter((s) => seg === 'all' || s.segment === seg)
      .filter((s) => {
        if (!query) return true
        const d = donorsById.get(s.donorId)!
        return `${d.firstName} ${d.lastName} ${d.email} ${d.city}`.toLowerCase().includes(query)
      })
      .sort((a, b) =>
        sort === 'name'
          ? donorsById.get(a.donorId)!.lastName.localeCompare(donorsById.get(b.donorId)!.lastName) || donorsById.get(a.donorId)!.firstName.localeCompare(donorsById.get(b.donorId)!.firstName)
          : sort === 'recent'
            ? a.features.recencyDays - b.features.recencyDays
            : b.expectedValue - a.expectedValue || b.actionProb - a.actionProb,
      )
  }, [scores, donorsById, q, seg, sort])

  const count = (s: Segment) => scores.filter((x) => x.segment === s).length

  return (
    <>
      <PageHeader title="Donateurs" subtitle="Toute votre base, avec la chance ou le risque calculé par Fidélia pour chaque donateur. Cliquez sur un nom pour voir pourquoi." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<Filter>
          value={seg}
          onChange={(v) => { setSeg(v); setLimit(PAGE) }}
          items={[
            { value: 'all', label: 'Tous', count: scores.length },
            ...(['monthly', 'one_time', 'annual', 'lapsed'] as Segment[]).map((s) => ({ value: s, label: SEGMENT_LABELS[s], count: count(s) })),
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-stone-500">
          Trier par
          <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setLimit(PAGE) }} className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-800">
            <option value="priority">Priorité (dons espérés)</option>
            <option value="recent">Dernier don le plus récent</option>
            <option value="name">Nom</option>
          </select>
        </label>
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
      </div>
      <p className="mb-4 text-xs text-stone-500"><b className="font-medium text-stone-600">Inactif</b> = a arrêté son don mensuel, ou aucun don depuis 12 mois (13 pour un annuel). Un ancien mensuel peut donc être inactif malgré un prélèvement récent.</p>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:min-w-[820px]">
            <thead className="border-b border-stone-100">
              <tr>
                <Th>Donateur</Th>
                <Th className="hidden sm:table-cell">Type</Th>
                <Th className="hidden text-right sm:table-cell">Donné (12 mois)</Th>
                <Th className="hidden text-right sm:table-cell">Dernier don</Th>
                <Th className="hidden text-right md:table-cell">Courriels ouverts</Th>
                <Th className="hidden sm:table-cell">Chance ou risque</Th>
                <Th className="text-right sm:text-left">Action</Th>
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
                    <Td className="hidden sm:table-cell"><span title={SEGMENT_HELP[s.segment]}><Badge className={SEGMENT_TONE[s.segment]}>{SEGMENT_LABELS[s.segment]}{s.segment === 'lapsed' && s.features.recencyDays < 365 && donorsById.get(s.donorId)?.churnDate ? ' · mensuel arrêté' : ''}</Badge></span></Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell">{formatMoney(s.features.amount12m)}</Td>
                    <Td className="hidden text-right tabular-nums text-stone-600 sm:table-cell">il y a {s.features.recencyDays} j</Td>
                    <Td className="hidden text-right tabular-nums text-stone-600 md:table-cell">{Math.round(s.features.openRate3m * 100)} %</Td>
                    <Td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <ProbBar value={s.actionProb} color={color} width="w-16" word={s.segment === 'monthly' ? (s.churnProb !== undefined && s.actionProb === s.churnProb ? 'risque de départ' : 'chance de hausse') : s.segment === 'lapsed' ? 'chance de retour' : 'chance de passer au mensuel'} />
                      </div>
                    </Td>
                    <Td className="text-right sm:text-left">{s.action ? <Badge className={ACTION_TONE[s.action]}>{ACTION_LABELS[s.action]}</Badge> : <span className="text-xs text-stone-400">—</span>}</Td>
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
