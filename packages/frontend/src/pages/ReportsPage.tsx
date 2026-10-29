import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BarChart3, TrendingUp, CalendarRange, Calculator, LineChart as LineIcon } from 'lucide-react'
import ComparisonSection from './reports/ComparisonSection'
import CashFlowSection from './reports/CashFlowSection'
import NetWorthSection from './reports/NetWorthSection'
import YearlySection from './reports/YearlySection'
import SimulatorSection from './reports/SimulatorSection'

type TabKey = 'comparison' | 'cashflow' | 'networth' | 'yearly' | 'simulator'

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: 'comparison', label: 'Comparativo', icon: BarChart3 },
  { key: 'cashflow', label: 'Fluxo de caixa', icon: TrendingUp },
  { key: 'networth', label: 'Patrimônio', icon: LineIcon },
  { key: 'yearly', label: 'Anual', icon: CalendarRange },
  { key: 'simulator', label: 'Simulador', icon: Calculator },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>('comparison')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Relatórios</h1>
        <p className="text-sm text-gray-500">Análises, projeções e simulações</p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 scrollbar-hide">
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4',
                tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              )}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'comparison' && <ComparisonSection />}
      {tab === 'cashflow' && <CashFlowSection />}
      {tab === 'networth' && <NetWorthSection />}
      {tab === 'yearly' && <YearlySection />}
      {tab === 'simulator' && <SimulatorSection />}
    </div>
  )
}
