import { useMemo, useState } from 'react'
import { CheckCircle2, Database, Download, FileUp, Mail, RefreshCw, Wand2, XCircle } from 'lucide-react'
import { Badge, Button, Card, PageHeader } from '../components/ui.tsx'
import { TechDetails } from '../components/plain/TechDetails.tsx'
import { generateDemo } from '../data/generate.ts'
import { download, exportDonations, exportDonors, exportEngagement, importCsv } from '../lib/csv.ts'
import { formatDate, fx } from '../lib/dates.ts'
import { ACTION_LABELS } from '../lib/labels.ts'
import { isOk, qualityReport, type QualityCheck } from '../lib/quality.ts'
import { useStore } from '../state/store.tsx'

/** Étiquette simple de chaque famille de contrôle (le nom savant reste dans le détail) */
const PLAIN_DIMENSION: Record<QualityCheck['dimension'], string> = {
  Complétude: 'Manquant',
  Validité: 'Erreur',
  Unicité: 'Doublon',
  Cohérence: 'Incohérent',
  Actualité: 'À jour ?',
  Accessibilité: 'Consentement',
}

/** Colonnes attendues dans chaque fichier, avec leur sens en français */
const COLUMNS: Record<'donors' | 'donations' | 'engagement', [string, string][]> = {
  donors: [
    ['id', 'numéro du donateur'], ['first_name', 'prénom'], ['last_name', 'nom'], ['email', 'courriel'], ['city', 'ville'],
    ['join_date', "date d'inscription"], ['kind', 'type de don : monthly (mensuel), one_time (ponctuel), annual (annuel)'], ['monthly_amount', 'montant mensuel'],
    ['churn_date', "date d'arrêt du don mensuel"], ['converted_at', 'date du passage au mensuel'], ['converted_from', 'type de don avant ce passage'],
    ['email_consent', 'accepte les courriels (oui/non)'], ['age', 'âge (facultatif, sert seulement à vérifier l\'équité)'], ['channel', 'canal de recrutement'],
  ],
  donations: [['donor_id', 'numéro du donateur'], ['date', 'date du don'], ['amount', 'montant'], ['kind', 'type de don'], ['status', 'paid (payé) ou failed (refusé)']],
  engagement: [['donor_id', 'numéro du donateur'], ['month', 'mois (AAAA-MM)'], ['open_rate', 'part des courriels ouverts, de 0 à 1']],
}

function ColumnList({ cols }: { cols: [string, string][] }) {
  return (
    <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-stone-500 sm:grid-cols-2">
      {cols.map(([c, fr]) => (
        <li key={c}><code className="rounded bg-stone-100 px-1 text-[11px] text-stone-700">{c}</code> {fr}</li>
      ))}
    </ul>
  )
}

export default function Data() {
  const { dataset, loadDataset, scores, donorsById } = useStore()
  const quality = useMemo(() => qualityReport(dataset), [dataset])
  const [size, setSize] = useState(4000)
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
      return [s.donorId, d.firstName, d.lastName, d.email, s.segment, fx(s.actionProb, 3), s.action ? ACTION_LABELS[s.action] : '', s.expectedValue, `"${s.reasons.map((r) => r.text).join(' | ')}"`].join(',')
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
          {dataset.donors.length.toLocaleString('fr-CA')} donateurs · {dataset.donations.length.toLocaleString('fr-CA')} dons · du {formatDate(dataset.historyStart)} au {formatDate(dataset.refDate)}
        </span>
      </div>

      <Card className="mb-6" title="Qualité des données" subtitle="Fidélia vérifie votre fichier automatiquement, à chaque chargement.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <tbody className="divide-y divide-stone-100">
              {quality.map((c) => {
                const ok = isOk(c)
                return (
                  <tr key={c.label}>
                    <td className="w-8 py-2.5 pl-5">{ok ? <CheckCircle2 className="size-4 text-brand-600" /> : <XCircle className="size-4 text-rose-500" />}</td>
                    <td className="px-3 py-2.5"><span title={c.dimension} className="whitespace-nowrap rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{PLAIN_DIMENSION[c.dimension]}</span></td>
                    <td className="px-3 py-2.5 text-stone-700">{c.label}</td>
                    <td className="py-2.5 pr-5 text-right tabular-nums text-stone-900">
                      {c.total > 1 ? `${c.value.toLocaleString('fr-CA')} / ${c.total.toLocaleString('fr-CA')} (${fx(((c.value / c.total) * 100), 1)} %)` : c.value}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-100 px-5 py-3">
          <TechDetails label="Voir le détail">
            <p className="text-xs text-stone-500">
              Les contrôles suivent les dimensions de qualité de Strong, Lee et Wang (1997) : complétude (Manquant), validité (Erreur), unicité (Doublon), cohérence, actualité et accessibilité (consentement).
              Les autres dimensions (crédibilité, interprétabilité…) sont décrites dans la fiche des données du dépôt (docs/DATASHEET-synthetique.md).
            </p>
          </TechDetails>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Importer vos données (CSV)" subtitle="Export depuis votre CRM ou votre outil de dons. Le modèle se réentraîne automatiquement.">
          <div className="space-y-3 p-5">
            {fileInput('donors', 'Donateurs', 'Une ligne par donateur · dates au format AAAA-MM-JJ')}
            {fileInput('donations', 'Dons', 'Une ligne par don ou prélèvement')}
            {fileInput('engagement', 'Ouverture des courriels', 'Une ligne par donateur et par mois', false)}
            <details className="rounded-xl bg-stone-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">Colonnes attendues et leur sens</summary>
              <p className="mt-2 text-xs font-medium text-stone-700">Donateurs</p>
              <ColumnList cols={COLUMNS.donors} />
              <p className="mt-2 text-xs font-medium text-stone-700">Dons</p>
              <ColumnList cols={COLUMNS.donations} />
              <p className="mt-2 text-xs font-medium text-stone-700">Ouverture des courriels (facultatif)</p>
              <ColumnList cols={COLUMNS.engagement} />
              <p className="mt-2 text-xs text-stone-500">Les noms de colonnes restent en anglais : ce sont ceux qu'exportent la plupart des outils de dons. « Modèles de fichiers » télécharge un exemple complet.</p>
            </details>
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

        <Card title="Données de démonstration" subtitle="Un OBNL québécois fictif simulé mois par mois sur 4 ans, calibré sur des taux de rétention publiés (environ 43 % des donateurs redonnent l'année suivante).">
          <div className="space-y-5 p-5">
            <label className="block">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-stone-800">Nombre de donateurs</span>
                <span className="tabular-nums text-stone-600">{size.toLocaleString('fr-CA')}</span>
              </div>
              <input type="range" min={500} max={8000} step={250} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1.5 w-full" />
            </label>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-stone-600">Options avancées</summary>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-stone-800">Graine aléatoire</span>
                <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="mt-1 h-9 w-32 rounded-lg border border-stone-200 px-3 text-sm" />
                <p className="mt-1 text-xs text-stone-400">Même graine = mêmes données, pour des résultats reproductibles.</p>
              </label>
            </details>
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
              { icon: Database, name: 'Base de données', desc: 'PostgreSQL géré au Canada : synchronisation hebdomadaire des dons' },
              { icon: Mail, name: "Fournisseur de courriels", desc: 'Brevo, Mailchimp : envoi et suivi des ouvertures' },
              { icon: RefreshCw, name: 'Plateforme de dons', desc: 'CanaDon, Zeffy, Stripe : import des prélèvements' },
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
