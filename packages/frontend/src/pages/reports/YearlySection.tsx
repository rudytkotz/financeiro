import { useState } from 'react'
import { useYearlyReport } from '@/hooks/useAnalytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function monthShort(ym: string) {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return names[parseInt(ym.split('-')[1]) - 1]
}

export default function YearlySection() {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data, isLoading } = useYearlyReport(year)

  const chart = (data?.byMonth ?? []).map((m) => ({
    month: monthShort(m.month),
    Receitas: m.income / 100,
    Despesas: m.expenses / 100,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setYear((y) => y - 1)} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4 text-gray-600" /></button>
        <span className="min-w-[70px] text-center text-sm font-semibold text-gray-700">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4 text-gray-600" /></button>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Receitas</p>
              <p className="mt-1 text-lg font-bold text-emerald-600 lg:text-xl">{fmt(data.totalIncome)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-red-300 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Despesas</p>
              <p className="mt-1 text-lg font-bold text-red-600 lg:text-xl">{fmt(data.totalExpenses)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Saldo</p>
              <p className={`mt-1 text-lg font-bold lg:text-xl ${data.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(data.balance)}</p>
            </div>
            <div className="rounded-2xl border border-l-4 border-l-blue-400 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Taxa de poupança</p>
              <p className="mt-1 text-lg font-bold text-gray-900 lg:text-xl">{data.savingsRate.toFixed(0)}%</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-700">Receitas x Despesas por mês</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {data.topCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-50 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Maiores categorias do ano</span>
              </div>
              <div className="divide-y divide-gray-50">
                {data.topCategories.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">{i + 1}. {c.categoryName}</span>
                    <span className="text-sm font-bold text-gray-800">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
              {data.mostExpensiveMonth && (
                <div className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400">
                  Mês mais caro: <span className="font-semibold text-gray-600">{monthShort(data.mostExpensiveMonth.month)}/{year}</span> ({fmt(data.mostExpensiveMonth.amount)})
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
