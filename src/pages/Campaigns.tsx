import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, Info, Mail, Send, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, Empty, PageHeader, Tabs, cx } from '../components/ui.tsx'
import { ACTION_LABELS, ACTION_TONE } from '../lib/labels.ts'
import type { CampaignItem } from '../lib/types.ts'
import { useStore } from '../state/store.tsx'

type Filter = 'todo' | 'sent' | 'dismissed'
const timeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Campaigns() {
  const { campaign, donorsById, updateItem, sendItems, resetCampaign } = useStore()
  const [filter, setFilter] = useState<Filter>('todo')
  const [current, setCurrent] = useState<string | null>(null)

  const groups = useMemo(
    () => ({
      todo: campaign.filter((c) => c.status === 'draft' || c.status === 'approved'),
      sent: campaign.filter((c) => c.status === 'sent'),
      dismissed: campaign.filter((c) => c.status === 'dismissed'),
    }),
    [campaign],
  )
  const list = groups[filter]
  const item: CampaignItem | undefined = list.find((c) => c.id === current) ?? list[0]
  const donor = item ? donorsById.get(item.donorId) : undefined
  const approved = groups.todo.filter((c) => c.status === 'approved')

  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Chaque email est rédigé à partir de l'action recommandée et des raisons détectées par le modèle. Relisez, ajustez, envoyez."
        actions={
          <>
            {campaign.length > 0 && (
              <Button variant="ghost" onClick={() => confirm('Vider tout l\'historique des emails ?') && resetCampaign()}>
                <Trash2 className="size-4" /> Vider
              </Button>
            )}
            <Button variant="secondary" disabled={!groups.todo.length} onClick={() => groups.todo.forEach((c) => updateItem(c.id, { status: 'approved' }))}>
              <CheckCheck className="size-4" /> Tout approuver
            </Button>
            <Button variant="primary" disabled={!approved.length} onClick={() => sendItems(approved.map((c) => c.id))}>
              <Send className="size-4" /> Envoyer les approuvés ({approved.length})
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        Envoi simulé : aucun email ne part réellement. Le branchement à un fournisseur (Brevo, Mailchimp, Resend…) est prévu dans une prochaine version.
      </div>

      <div className="mb-4">
        <Tabs<Filter>
          value={filter}
          onChange={(v) => { setFilter(v); setCurrent(null) }}
          items={[
            { value: 'todo', label: 'À envoyer', count: groups.todo.length },
            { value: 'sent', label: 'Envoyés', count: groups.sent.length },
            { value: 'dismissed', label: 'Ignorés', count: groups.dismissed.length },
          ]}
        />
      </div>

      {!list.length ? (
        <Card>
          <Empty icon={<Mail className="size-5" />} title={filter === 'todo' ? 'Aucun email en attente' : 'Rien ici pour le moment'}>
            {filter === 'todo' && (
              <>
                Préparez des emails depuis les <Link className="font-medium text-brand-600" to="/recommandations">recommandations</Link> ou lancez une{' '}
                <Link className="font-medium text-brand-600" to="/automatisations">automatisation</Link>.
              </>
            )}
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="max-h-[70vh] overflow-y-auto">
            <ul className="divide-y divide-stone-100">
              {list.map((c) => {
                const d = donorsById.get(c.donorId)
                return (
                  <li key={c.id}>
                    <button onClick={() => setCurrent(c.id)} className={cx('w-full px-4 py-3 text-left hover:bg-stone-50', item?.id === c.id && 'bg-brand-50/60')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-stone-900">{d ? `${d.firstName} ${d.lastName}` : c.donorId}</p>
                        {c.status === 'approved' && <Badge className="bg-brand-50 text-brand-700 ring-brand-100">Approuvé</Badge>}
                        {c.origin === 'auto' && c.status !== 'approved' && <Badge>Auto</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-stone-500">{c.subject}</p>
                      <p className="mt-1.5"><Badge className={ACTION_TONE[c.type]}>{ACTION_LABELS[c.type]}</Badge></p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {item && (
            <Card>
              <div className="border-b border-stone-100 px-6 py-4 text-sm">
                <p className="text-stone-500">À : <span className="text-stone-900">{donor ? `${donor.firstName} ${donor.lastName} <${donor.email}>` : item.donorId}</span></p>
                <p className="mt-1 text-xs text-stone-400">
                  Créé le {timeFmt.format(new Date(item.createdAt))}
                  {item.sentAt && ` · envoyé le ${timeFmt.format(new Date(item.sentAt))}`}
                  {item.origin === 'auto' && ' · généré par une automatisation'}
                </p>
              </div>
              <div className="space-y-4 p-6">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Objet</span>
                  <input
                    value={item.subject}
                    disabled={item.status === 'sent'}
                    onChange={(e) => updateItem(item.id, { subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Message</span>
                  <textarea
                    value={item.body}
                    disabled={item.status === 'sent'}
                    onChange={(e) => updateItem(item.id, { body: e.target.value })}
                    rows={14}
                    className="mt-1 w-full resize-y rounded-lg border border-stone-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
                  />
                </label>
                {item.status !== 'sent' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.status !== 'dismissed' && (
                      <Button variant="ghost" onClick={() => updateItem(item.id, { status: 'dismissed' })}>
                        <X className="size-4" /> Ignorer
                      </Button>
                    )}
                    {item.status === 'draft' && (
                      <Button variant="secondary" onClick={() => updateItem(item.id, { status: 'approved' })}>
                        <CheckCheck className="size-4" /> Approuver
                      </Button>
                    )}
                    {item.status === 'dismissed' ? (
                      <Button variant="secondary" onClick={() => updateItem(item.id, { status: 'draft' })}>Restaurer</Button>
                    ) : (
                      <Button variant="primary" onClick={() => sendItems([item.id])}>
                        <Send className="size-4" /> Envoyer
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
