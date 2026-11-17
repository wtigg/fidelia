import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Layout } from './components/Layout.tsx'

// une page = un fichier chargé à la demande : le premier affichage est plus rapide.
// Après une mise en ligne, l'ancien fichier peut avoir disparu : on recharge alors la page une fois.
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    load()
      .then((m) => {
        try { sessionStorage.removeItem('fidelia-reload') } catch { /* stockage indisponible */ }
        return m
      })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem('fidelia-reload')) {
            sessionStorage.setItem('fidelia-reload', '1')
            location.reload()
            return new Promise<never>(() => {})
          }
        } catch { /* stockage indisponible */ }
        throw err
      }),
  )
}

const Dashboard = lazyPage(() => import('./pages/Dashboard.tsx'))
const Recommendations = lazyPage(() => import('./pages/Recommendations.tsx'))
const Impact = lazyPage(() => import('./pages/Impact.tsx'))
const Donors = lazyPage(() => import('./pages/Donors.tsx'))
const Campaigns = lazyPage(() => import('./pages/Campaigns.tsx'))
const Automations = lazyPage(() => import('./pages/Automations.tsx'))
const Model = lazyPage(() => import('./pages/Model.tsx'))
const Data = lazyPage(() => import('./pages/Data.tsx'))

function PageLoading() {
  return (
    <p role="status" className="flex items-center gap-2 py-16 text-sm text-stone-500">
      <Loader2 className="size-4 animate-spin" /> Chargement de la page…
    </p>
  )
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recommandations" element={<Recommendations />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/donateurs" element={<Donors />} />
          <Route path="/campagnes" element={<Campaigns />} />
          <Route path="/automatisations" element={<Automations />} />
          <Route path="/modele" element={<Model />} />
          <Route path="/donnees" element={<Data />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
