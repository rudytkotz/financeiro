import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Tag,
  Users,
  Shield,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'

export default function Layout() {
  const { user, logout } = useAuth()
  const { isDark, toggle } = useDarkMode()
  const navigate = useNavigate()

  const navItems = [
    { to: '/', label: 'Painel', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
    { to: '/import', label: 'Importar', icon: Upload },
    { to: '/categories', label: 'Categorias', icon: Tag },
    { to: '/dependents', label: 'Dependentes', icon: Users },
    ...(user?.isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-10 md:w-56 md:flex-col md:border-r md:bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <h2 className="text-lg font-semibold">Financeiro</h2>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {/* User + dark mode + logout */}
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={toggle} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title={isDark ? 'Modo claro' : 'Modo escuro'}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate mx-2">{user?.username}</span>
            <button onClick={handleLogout} className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 md:ml-56">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t bg-card py-2 md:hidden safe-bottom">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}>
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
