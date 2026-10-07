import { useState } from 'react'
import { Database, Download, FileUp, Mail, RefreshCw, Wand2 } from 'lucide-react'
import { Badge, Button, Card, PageHeader } from '../components/ui.tsx'
import { generateDemo } from '../data/generate.ts'
import { download, exportDonations, exportDonors, exportEngagement, importCsv } from '../lib/csv.ts'
import { formatDate } from '../lib/dates.ts'
import { ACTION_LABELS } from '../lib/labels.ts'
import { useStore } from '../state/store.tsx'

export default function Data() {
  const { dataset, loadDataset, scores, donorsById } = useStore()
  const [size, setSize] = useState(2000)
  const [seed, setSeed] = useState(42)
  const [files, setFiles] = useState<{ donors?: File; donations?: File; engagement?: File }>({})
  const [error, setError] = useState<string>()
  const [ok, setOk] = useState<string>()

  const runImport = async () => {
    setError(undefined)
    setOk(undefined)
    try {
      if (!files.donors || !files.donations) throw new Error('Sélectionnez au moins le fichier des donateurs et celui des dons.')
      const ds = importCsv(await files.donors.text(), await files.donations.text(), files.engagement ? await files.engagement.text() : undefined)
      loadDataset(ds)
      setOk(`${ds.donors.length} donateurs et ${ds.donations.length} dons importés. Le modèle se réentraîne sur vos données.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const exportScores = () => {
    const header = 'donor_id,first_name,last_name,email,segment,probability,action,expected_value,reasons'
    const rows = scores.map((s) => {
      const d = donorsById.get(s.donorId)!
      return [s.donorId, d.firstName, d.lastName, d.email, s.segment, s.actionProb.toFixed(3), s.action ? ACTION_LABELS[s.action] : '', s.expectedValue, `"${s.reasons.map((r) => r.text).join(' | ')}"`].join(',')
    })
    download('fidelia-scores.csv', [header, ...rows].join('\n'))
  }

  const fileInput = (key: keyof typeof files, label: string, hint: string, required = true) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 hover:border-brand-500">
      <FileUp className="size-5 text-stone-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800">
          {label} {!required && <span className="font-normal text-stone-400">(optionnel)</span>}
        </p>
        <p className="truncate text-xs text-stone-500">{files[key]?.name ?? hint}</p>
      </div>
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFiles({ ...files, [key]: e.target.files?.[0] })} />
    </label>
  )

  return (
    <>
      <PageHeader title="Données" subtitle="Branchez les données de votre association ou explorez l'application avec des données de démonstration." />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm">
        <Database className="size-5 text-brand-600" />
        <span className="font-medium text-stone-900">Source active :</span>
        <Badge className="bg-brand-50 text-brand-700 ring-brand-100">{dataset.source === 'demo' ? 'Démo générée' : dataset.source === 'csv' ? 'Import CSV' : 'Supabase'}</Badge>
        <span className="text-stone-500">
          {dataset.donors.length.toLocaleString('fr-FR')} donateurs · {dataset.donations.length.toLocaleString('fr-FR')} dons · du {formatDate(dataset.historyStart)} au {formatDate(dataset.refDate)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Importer vos données (CSV)" subtitle="Export depuis votre CRM ou votre outil de dons. Le modèle se réentraîne automatiquement.">
          <div className="space-y-3 p-5">
            {fileInput('donors', 'Donateurs', 'id, first_name, last_name, email, city, join_date, kind, monthly_amount, churn_date, converted_at, converted_from, email_consent')}
            {fileInput('donations', 'Dons', 'donor_id, date, amount, kind, status')}
            {fileInput('engagement', 'Engagement email', 'donor_id, month (AAAA-MM), open_rate', false)}
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{ok}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="primary" onClick={runImport}>
                <FileUp className="size-4" /> Importer et entraîner
              </Button>
              <Button variant="ghost" onClick={() => { download('donateurs.csv', exportDonors(dataset)); download('dons.csv', exportDonations(dataset)); download('engagement.csv', exportEngagement(dataset)) }}>
                <Download className="size-4" /> Modèles de fichiers
              </Button>
            </div>
            <p className="text-xs text-stone-400">Les fichiers sont lus dans votre navigateur et ne sont envoyés à aucun serveur.</p>
          </div>
        </Card>

        <Card title="Données de démonstration" subtitle="Une association fictive simulée mois par mois, avec des comportements réalistes (échecs de paiement, baisse d'engagement, conversions…).">
          <div className="space-y-5 p-5">
            <label className="block">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-stone-800">Nombre de donateurs</span>
                <span className="tabular-nums text-stone-600">{size.toLocaleString('fr-FR')}</span>
              </div>
              <input type="range" min={300} max={5000} step={100} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1.5 w-full accent-brand-600" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-800">Graine aléatoire</span>
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="mt-1 h-9 w-32 rounded-lg border border-stone-200 px-3 text-sm" />
              <p className="mt-1 text-xs text-stone-400">Même graine = mêmes données, pour des résultats reproductibles.</p>
            </label>
            <Button variant="secondary" onClick={() => { loadDataset(generateDemo(size, seed)); setOk(undefined) }}>
              <Wand2 className="size-4" /> Générer et réentraîner
            </Button>
          </div>
        </Card>

        <Card title="Exporter" subtitle="Récupérez les scores pour votre CRM ou un publipostage.">
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="secondary" onClick={exportScores}><Download className="size-4" /> Scores et recommandations</Button>
            <Button variant="secondary" onClick={() => download('donateurs.csv', exportDonors(dataset))}><Download className="size-4" /> Donateurs</Button>
            <Button variant="secondary" onClick={() => download('dons.csv', exportDonations(dataset))}><Download className="size-4" /> Dons</Button>
          </div>
        </Card>

        <Card title="Connexions" subtitle="Synchronisation automatique avec vos outils.">
          <ul className="divide-y divide-stone-100">
            {[
              { icon: Database, name: 'Base de données', desc: 'Supabase / PostgreSQL : synchronisation nocturne des dons' },
              { icon: Mail, name: "Fournisseur d'emails", desc: 'Brevo, Mailchimp, Resend : envoi et suivi des ouvertures' },
              { icon: RefreshCw, name: 'Plateforme de dons', desc: 'HelloAsso, iRaiser, Stripe : import des prélèvements' },
            ].map(({ icon: Icon, name, desc }) => (
              <li key={name} className="flex items-center gap-3 px-5 py-4">
                <span className="grid size-9 place-items-center rounded-lg bg-stone-100 text-stone-500"><Icon className="size-4" /></span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">{name}</p>
                  <p className="text-xs text-stone-500">{desc}</p>
                </div>
                <Badge>Bientôt</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
