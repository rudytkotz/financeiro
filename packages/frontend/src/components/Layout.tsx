import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Tag,
  Users,
} from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { to: '/import', label: 'Importar', icon: Upload },
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/dependents', label: 'Dependentes', icon: Users },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 w-64 border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <h2 className="text-lg font-semibold">Financeiro</h2>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="ml-64 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
