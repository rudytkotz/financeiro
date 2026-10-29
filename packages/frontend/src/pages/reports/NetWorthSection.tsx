import { useNetWorth } from '@/hooks/useAnalytics'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function label(ym: string) {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`
}

export default function NetWorthSection() {
  const { data, isLoading } = useNetWorth(12)

  const chart = (data ?? []).map((p) => ({
    month: label(p.month),
    Contas: p.accounts / 100,
    Investimentos: p.investments / 100,
    Total: p.total / 100,
  }))

  const last = data && data.length ? data[data.length - 1] : null

  return (
    <div className="space-y-4">
      {last && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Patrimônio total</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{fmt(last.total)}</p>
          </div>
          <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Em contas</p>
            <p className="mt-1 text-xl font-bold text-gray-700">{fmt(last.accounts)}</p>
          </div>
          <div className="rounded-2xl border border-l-4 border-l-amber-400 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Investido</p>
            <p className="mt-1 text-xl font-bold text-gray-700">{fmt(last.investments)}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-gray-700">Evolução do patrimônio (12 meses)</h2>
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
        ) : chart.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Sem dados para exibir.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Contas" stackId="1" stroke="#10b981" fill="url(#gAcc)" strokeWidth={2} />
              <Area type="monotone" dataKey="Investimentos" stackId="1" stroke="#f59e0b" fill="url(#gInv)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-[10px] text-gray-400">
          O saldo de contas é reconstruído mês a mês pelas movimentações. O investido usa o valor atual de mercado como referência.
        </p>
      </div>
    </div>
  )
}
