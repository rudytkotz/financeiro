import { useState } from 'react'
import { useMonthComparison } from '@/hooks/useAnalytics'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus } from 'lucide-react'

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function offset(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function label(ym: string) {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]} ${y}`
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400">—</span>
  const up = pct > 0
  const flat = pct === 0
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown
  // Em despesas, subir é "ruim" (vermelho), cair é "bom" (verde)
  const color = flat ? 'text-gray-400' : up ? 'text-red-500' : 'text-emerald-500'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />{Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function ComparisonSection() {
  const [month, setMonth] = useState(currentMonth())
  const { data, isLoading } = useMonthComparison(month, 3)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setMonth(offset(month, -1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4 text-gray-600" /></button>
        <span className="min-w-[110px] text-center text-sm font-semibold text-gray-700">{label(month)}</span>
        <button onClick={() => setMonth(offset(month, 1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4 text-gray-600" /></button>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Este mês</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{fmt(data.currentTotal)}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">vs anterior <Delta pct={data.changePct} /></div>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-gray-300 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Mês anterior</p>
              <p className="mt-1 text-xl font-bold text-gray-700">{fmt(data.previousTotal)}</p>
              <p className="mt-1 text-[11px] text-gray-400">{label(data.previousMonth)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-blue-400 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Média ({data.monthsAnalyzed}m)</p>
              <p className="mt-1 text-xl font-bold text-gray-700">{fmt(data.averageTotal)}</p>
              <p className="mt-1 text-[11px] text-gray-400">últimos {data.monthsAnalyzed} meses</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-50 px-4 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Por categoria</span>
            </div>
            {data.categories.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Sem despesas neste período.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.categories.map((c) => (
                  <div key={c.categoryId ?? 'none'} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">{c.categoryName}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400 hidden sm:inline">méd {fmt(c.average)}</span>
                      <span className="text-xs text-gray-400">ant {fmt(c.previous)}</span>
                      <span className="w-24 text-right text-sm font-bold text-gray-800">{fmt(c.current)}</span>
                      <span className="w-14 text-right"><Delta pct={c.changePct} /></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
