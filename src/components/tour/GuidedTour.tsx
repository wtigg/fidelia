import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useStore } from '../../state/store.tsx'
import { Button, cx } from '../ui.tsx'

/**
 * Visite guidée en 6 étapes, alignée sur le script de démonstration (docs/PRESENTATION.md).
 * Chaque étape ouvre la bonne page, fait défiler jusqu'à l'élément utile et affiche une phrase simple.
 * La dernière étape montre la tâche du lundi : le courriel prêt à relire dans Courriels.
 */
interface Step {
  to: string
  title: string
  text: (n: string) => string
  /** La fiche s'ouvre à droite : la bulle passe alors à gauche */
  left?: boolean
  /** id de l'élément à faire défiler au centre de l'écran */
  focus?: string
  /** Prépare un brouillon de courriel si aucun n'attend (étape Courriels) */
  needsDraft?: boolean
}

const TOUR_STEPS: Step[] = [
  {
    to: '/',
    title: 'Tableau de bord',
    text: (n) => `Voici vos ${n} donateurs. En haut : la valeur des dons mensuels à risque et les priorités du jour.`,
  },
  {
    to: '/recommandations',
    title: 'Recommandations',
    text: () => 'Fidélia vous dit par où commencer : qui relancer, qui remercier, qui solliciter. Les plus utiles sont en haut.',
  },
  {
    to: '/recommandations?type=churn_prevention&fiche=auto',
    title: "La fiche d'un donateur",
    text: () => 'Un donateur à relancer. Fidélia montre son risque, les raisons et son historique. Vous décidez, puis le courriel est préparé.',
    left: true,
  },
  {
    to: '/impact',
    title: 'Impact',
    text: () => 'À effort égal, combien de dons Fidélia retrouve, comparé à la méthode habituelle (dernier don, fréquence, montant). Faites glisser « Donateurs contactés ».',
    focus: 'capacite',
  },
  {
    to: '/modele',
    title: 'Modèle IA (facultatif)',
    text: () => "Le modèle apprend des dons passés. On ne l'utilise que s'il remplit nos deux conditions. Sinon, Fidélia garde la méthode habituelle.",
  },
  {
    to: '/campagnes',
    title: 'Lundi matin : vos courriels',
    text: () => 'Le brouillon est prêt, sans montant inventé. Relisez, corrigez si besoin, puis « Approuver » et « Envoyer ». Rien ne part sans vous.',
    left: true,
    focus: 'courriel-actions',
    needsDraft: true,
  },
]

const isSmall = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639px)').matches

export function GuidedTour({ step, onStep }: { step: number | null; onStep: (s: number | null) => void }) {
  const navigate = useNavigate()
  const { dataset, scores, campaign, donorsById, createDrafts } = useStore()
  // Sur téléphone, la bulle démarre repliée : une barre basse avec le titre et « Suivant »
  const [collapsed, setCollapsed] = useState(isSmall)

  const go = (i: number | null) => {
    onStep(i)
    if (i === null) return
    const s = TOUR_STEPS[i]
    if (s.needsDraft && !campaign.some((c) => c.status === 'draft' || c.status === 'approved')) {
      // trois donateurs à relancer : au moins un brouillon, même si l'un d'eux est mis de côté pour mesurer
      const busy = new Set(campaign.map((c) => c.donorId))
      const ids = scores
        .filter((x) => x.action === 'churn_prevention' && donorsById.get(x.donorId)?.emailConsent && !busy.has(x.donorId))
        .slice(0, 3)
        .map((x) => x.donorId)
      if (ids.length) createDrafts(ids)
    }
    navigate(s.to)
  }

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStep(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onStep])

  // Fait défiler jusqu'à l'élément utile (le curseur d'Impact est sous l'encadré « Pourquoi Fidélia »)
  useEffect(() => {
    const id = step !== null ? TOUR_STEPS[step]?.focus : undefined
    if (!id) return
    // la page change en même temps : on attend que l'élément existe (au plus 3 s)
    let tries = 0
    const t = window.setInterval(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el || ++tries > 15) window.clearInterval(t)
    }, 200)
    return () => window.clearInterval(t)
  }, [step])

  if (step === null) return null
  const s = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1
  const next = (
    <Button variant="primary" size="sm" onClick={() => go(last ? null : step + 1)}>
      {last ? 'Terminer' : <>Suivant <ArrowRight className="size-3.5" /></>}
    </Button>
  )

  if (collapsed)
    return (
      <div role="dialog" aria-modal="false" aria-labelledby="tour-title" className="fixed inset-x-3 bottom-3 z-[70] flex items-center gap-2 rounded-xl border border-brand-100 bg-white p-2.5 shadow-2xl ring-1 ring-black/5">
        <button onClick={() => setCollapsed(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Afficher l'explication">
          <ChevronUp className="size-4 shrink-0 text-brand-600" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-brand-600">Visite · {step + 1} sur {TOUR_STEPS.length}</span>
            <span id="tour-title" className="block truncate text-sm font-semibold text-stone-900">{s.title}</span>
          </span>
        </button>
        {next}
        <button onClick={() => go(null)} aria-label="Quitter la visite" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
          <X className="size-4" />
        </button>
      </div>
    )

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className={cx(
        'fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-brand-100 bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:inset-x-auto sm:bottom-4 sm:w-[400px] sm:p-5',
        s.left ? 'sm:left-6 lg:left-[17.5rem]' : 'sm:right-6',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Visite guidée · {step + 1} sur {TOUR_STEPS.length}</p>
          <h2 id="tour-title" className="mt-1 font-display text-lg font-semibold text-stone-900">{s.title}</h2>
        </div>
        <div className="flex">
          <button onClick={() => setCollapsed(true)} aria-label="Replier la bulle" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 sm:hidden">
            <ChevronDown className="size-4" />
          </button>
          <button onClick={() => go(null)} aria-label="Quitter la visite" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">{s.text(dataset.donors.length.toLocaleString('fr-CA'))}</p>
      <div className="mt-4 hidden items-center gap-1.5 sm:flex" aria-hidden>
        {TOUR_STEPS.map((_, i) => (
          <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-brand-500' : 'w-1.5 bg-stone-200')} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 sm:mt-4">
        <Button variant="ghost" size="sm" onClick={() => go(null)}>Quitter</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={step === 0} onClick={() => go(step - 1)}>
            <ArrowLeft className="size-3.5" /> Précédent
          </Button>
          {next}
        </div>
      </div>
    </div>
  )
}
