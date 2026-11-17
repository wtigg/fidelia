import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, BrainCircuit, Database, HeartHandshake, LayoutDashboard, Loader2, Mail, Menu, PlayCircle, Sparkles, TrendingUp, Users, Zap } from 'lucide-react'
import { formatDate } from '../lib/dates.ts'
import { ORG_NAME, setEmailContext } from '../lib/emails.ts'
import { MODEL_SPECS } from '../ml/pipeline.ts'
import { useStore } from '../state/store.tsx'
import { GuidedTour } from './tour/GuidedTour.tsx'
import { cx } from './ui.tsx'

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/recommandations', label: 'Recommandations', icon: Sparkles },
  { to: '/impact', label: 'Impact', icon: TrendingUp },
  { to: '/donateurs', label: 'Donateurs', icon: Users },
  { to: '/campagnes', label: 'Courriels', icon: Mail },
  { to: '/automatisations', label: 'Automatisations', icon: Zap },
  { to: '/modele', label: 'Modèle IA', icon: BrainCircuit },
  { to: '/donnees', label: 'Données', icon: Database },
]

export function Layout({ children }: { children: ReactNode }) {
  const { training, trainingStep, trainError, trainSkipped, dataset, campaign, scores, modelTrainedAt } = useStore()
  const [open, setOpen] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const drafts = campaign.filter((c) => c.status === 'draft' || c.status === 'approved').length
  const recos = scores.filter((s) => s.action).length

  // les brouillons de courriels citent le dernier don réel (montant, date)
  useEffect(() => setEmailContext(dataset), [dataset])

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-brand-100/70 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {to === '/recommandations' && recos > 0 && <span className="rounded-md bg-gold px-1.5 text-xs font-semibold text-brand-900 tabular-nums">{recos}</span>}
          {to === '/campagnes' && drafts > 0 && <span className="rounded-md bg-white/15 px-1.5 text-xs tabular-nums">{drafts}</span>}
        </NavLink>
      ))}
    </nav>
  )

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 px-3 py-5 text-white">
      <div className="mb-8 flex items-center gap-2.5 px-3">
        <span className="grid size-8 place-items-center rounded-lg bg-gold text-brand-900">
          <HeartHandshake className="size-[18px]" />
        </span>
        <span className="font-display text-xl font-semibold">Fidélia</span>
      </div>
      {nav}
      <button
        onClick={() => {
          setOpen(false)
          setTourStep(0)
          navigate('/')
        }}
        className="mt-6 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-brand-100/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <PlayCircle className="size-4" /> Visite guidée
      </button>
      <div className="mt-auto rounded-xl bg-white/5 p-3 text-xs text-brand-100/70">
        <p className="font-medium text-white">{ORG_NAME}</p>
        <p className="mt-0.5">{dataset.donors.length.toLocaleString('fr-CA')} donateurs · {dataset.source === 'demo' ? 'données de démo' : dataset.source === 'csv' ? 'fichier importé' : 'base en ligne'}</p>
        <p className="mt-0.5">Données au {formatDate(dataset.refDate)}</p>
        <p className="mt-2 flex items-center gap-1.5">
          {training ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Analyse en cours{trainingStep ? ` : ${MODEL_SPECS[trainingStep].title.toLowerCase()}` : '…'}
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-emerald-400" /> Modèle entraîné le {formatDate(modelTrainedAt)}
            </>
          )}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-display text-lg font-semibold text-brand-900">Fidélia</span>
        <button onClick={() => setOpen(true)} aria-label="Menu" className="rounded-lg p-2 text-stone-600 hover:bg-stone-100">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}
      <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
        {trainError && (
          <p role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>L'entraînement a échoué.</b> Le fichier importé est peut-être trop petit ou mal formé. Aucun score n'est affiché. Vérifiez les colonnes dans l'onglet Données, puis importez de nouveau. <span className="text-rose-700">Détail : {trainError}</span>
            </span>
          </p>
        )}
        {!training && !trainError && trainSkipped.length > 0 && (
          <p role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>Données insuffisantes pour : {trainSkipped.map((k) => MODEL_SPECS[k].title).join(', ')}.</b> Fidélia ne propose pas encore ces actions : il manque d'exemples dans l'historique importé. <details className="mt-1 inline"><summary className="cursor-pointer underline">Voir le détail</summary> Minimum technique : 100 exemples, dont 10 cas positifs à l'entraînement, et 3 cas positifs en validation comme en test. Entre ce minimum et 100 cas positifs (requis RD1), le modèle est entraîné mais Fidélia classe avec la méthode habituelle.</details>
            </span>
          </p>
        )}
        {children}
      </main>
      <GuidedTour step={tourStep} onStep={setTourStep} />
    </div>
  )
}
