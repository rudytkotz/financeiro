import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  LineChart,
  Users,
  Shield,
  LogOut,
  Moon,
  Sun,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'

export default function Layout() {
  const { user, logout } = useAuth()
  const { isDark, toggle } = useDarkMode()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = [
    { to: '/', label: 'Painel', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
    { to: '/accounts', label: 'Contas', icon: Wallet },
    { to: '/goals', label: 'Metas', icon: Target },
    { to: '/investments', label: 'Investimentos', icon: LineChart },
    { to: '/dependents', label: 'Dependentes', icon: Users },
    ...(user?.isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  // No mobile, mostramos os 4 primeiros na barra; o resto vai no menu "Mais"
  const primaryMobileItems = navItems.slice(0, 4)
  const secondaryMobileItems = navItems.slice(4)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-10 md:w-56 md:flex-col md:border-r md:bg-card" style={{ background: 'linear-gradient(180deg, hsl(243,75%,18%) 0%, hsl(243,60%,14%) 100%)' }}>
        <div className="flex h-14 items-center border-b border-white/10 px-4 gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14H7v-2h6v2zm4-4H7v-2h10v2zm0-4H7V6h10v2z"/></svg>
          </div>
          <h2 className="text-sm font-bold text-white tracking-wide">Financeiro</h2>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2.5 pt-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/55 hover:bg-white/8 hover:text-white/90'
              )}>
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-white' : 'text-white/50')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {/* User + dark mode + logout */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center justify-between">
            <button onClick={toggle} className="rounded-lg p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 transition" title={isDark ? 'Modo claro' : 'Modo escuro'}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="text-xs font-medium text-white/60 truncate mx-2">{user?.username}</span>
            <button onClick={handleLogout} className="rounded-lg p-1.5 text-white/40 hover:text-red-300 hover:bg-white/10 transition" title="Sair">
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

      {/* Mobile bottom navigation — 4 principais + botão "Mais" */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t bg-card py-1.5 md:hidden safe-bottom">
        {primaryMobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-1 py-1 text-[9px] font-medium transition-colors min-w-[56px]',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}>
            <Icon className="h-5 w-5" />
            <span className="truncate max-w-[56px]">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 px-1 py-1 text-[9px] font-medium text-muted-foreground transition-colors min-w-[56px]"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200 safe-bottom">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-foreground">Menu</span>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondaryMobileItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-medium transition',
                    isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}>
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{label}</span>
                </NavLink>
              ))}
            </div>
            {/* Dark mode + logout */}
            <div className="mt-3 flex gap-2">
              <button onClick={() => { toggle(); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button onClick={() => { setMoreOpen(false); handleLogout() }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
