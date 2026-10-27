import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'

// Páginas carregadas sob demanda (code-splitting) para reduzir o bundle inicial.
// Dashboard e Investimentos usam recharts (pesado) — ficam fora do carregamento inicial.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))
const InvestmentsPage = lazy(() => import('./pages/InvestmentsPage'))
const DependentsPage = lazy(() => import('./pages/DependentsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route
          path="/"
          element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>}
        />
        <Route
          path="/transactions"
          element={<Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>}
        />
        <Route
          path="/accounts"
          element={<Suspense fallback={<PageLoader />}><AccountsPage /></Suspense>}
        />
        <Route
          path="/goals"
          element={<Suspense fallback={<PageLoader />}><GoalsPage /></Suspense>}
        />
        <Route
          path="/investments"
          element={<Suspense fallback={<PageLoader />}><InvestmentsPage /></Suspense>}
        />
        <Route
          path="/dependents"
          element={<Suspense fallback={<PageLoader />}><DependentsPage /></Suspense>}
        />
        {/* Rotas antigas agora vivem dentro de Transações (abas) */}
        <Route path="/import" element={<Navigate to="/transactions" replace state={{ tab: 'import' }} />} />
        <Route path="/imports" element={<Navigate to="/transactions" replace state={{ tab: 'import' }} />} />
        <Route path="/categories" element={<Navigate to="/transactions" replace state={{ tab: 'categories' }} />} />
        <Route
          path="/admin"
          element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminPage /></Suspense></AdminRoute>}
        />
      </Route>
    </Routes>
  )
}

export default App
