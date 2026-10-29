import { useState } from 'react'
import { useCashFlow } from '@/hooks/useAnalytics'
import { ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Repeat, Wallet } from 'lucide-react'

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
function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function CashFlowSection() {
  const [month, setMonth] = useState(currentMonth())
  const { data, isLoading } = useCashFlow(month)

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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-400"><Wallet className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">Saldo hoje</span></div>
              <p className={`mt-1 text-lg font-bold lg:text-xl ${data.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(data.currentBalance)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-red-300 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">A sair</p>
              <p className="mt-1 text-lg font-bold text-red-600 lg:text-xl">{fmt(data.projectedExpenses)}</p>
              <p className="text-[11px] text-gray-400">já saiu: {fmt(data.realizedExpenses)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">A entrar</p>
              <p className="mt-1 text-lg font-bold text-emerald-600 lg:text-xl">{fmt(data.projectedIncome)}</p>
              <p className="text-[11px] text-gray-400">já entrou: {fmt(data.realizedIncome)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Saldo projetado</p>
              <p className={`mt-1 text-lg font-bold lg:text-xl ${data.projectedEndBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(data.projectedEndBalance)}</p>
              <p className="text-[11px] text-gray-400">fim do mês</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-50 px-4 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Previsto até o fim do mês</span>
            </div>
            {data.pendingItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Nada pendente. Tudo em dia este mês.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.pendingItems.map((item, i) => {
                  const isOut = item.amount > 0
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`rounded-lg p-1.5 ${isOut ? 'bg-red-50' : 'bg-emerald-50'}`}>
                          {item.kind === 'recorrente' ? <Repeat className={`h-3.5 w-3.5 ${isOut ? 'text-red-500' : 'text-emerald-500'}`} />
                            : isOut ? <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" /> : <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.description}</p>
                          <p className="text-[11px] text-gray-400">{fmtDate(item.date)} · {item.kind}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${isOut ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isOut ? '-' : '+'}{fmt(Math.abs(item.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
