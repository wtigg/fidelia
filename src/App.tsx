import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import Automations from './pages/Automations.tsx'
import Campaigns from './pages/Campaigns.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Data from './pages/Data.tsx'
import Donors from './pages/Donors.tsx'
import Impact from './pages/Impact.tsx'
import Model from './pages/Model.tsx'
import Recommendations from './pages/Recommendations.tsx'

export default function App() {
  return (
    <Layout>
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
    </Layout>
  )
}
