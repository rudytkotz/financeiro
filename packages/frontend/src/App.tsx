import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import ImportPage from './pages/ImportPage'
import CategoriesPage from './pages/CategoriesPage'
import DependentsPage from './pages/DependentsPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/dependents" element={<DependentsPage />} />
      </Route>
    </Routes>
  )
}

export default App
