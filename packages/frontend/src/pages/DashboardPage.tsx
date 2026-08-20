import { useState, FormEvent } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useSetIncome } from '@/hooks/useMutations'
import { CreditCard, Smartphone, Wallet, Banknote, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof CreditCard; color: string }> = {
  credito: { label: 'Cartão de Crédito', icon: CreditCard, color: '#3b82f6' },
  pix: { label: 'Pix', icon: Smartphone, color: '#10b981' },
  debito: { label: 'Débito', icon: Wallet, color: '#8b5cf6' },
  dinheiro: { label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  outros: { label: 'Outros', icon: Wallet, color: '#6b7280' },
}

function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(m, 10) - 1]} ${year}`
}

export default function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const { data: dashboard, isLoading } = useDashboard(month)
  const setIncomeMutation = useSetIncome()
  const [incomeInput, setIncomeInput] = useState('')

  const handleSetIncome = (e: FormEvent) => {
    e.preventDefault()
    const value = parseFloat(incomeInput.replace(',', '.'))
    if (isNaN(value)) return
    const cents = Math.round(value * 100)
    if (cents < 1 || cents > 99999999999) return
    setIncomeMutation.mutate(
      { month, payload: { amount: cents } },
      { onSuccess: () => setIncomeInput('') }
    )
  }

  const hasNoData =
    dashboard &&
    dashboard.totalExpenses === 0 &&
    dashboard.incomeAmount === null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Financeiro</h1>
          <p className="text-sm text-gray-500">{formatMonthLabel(month)}</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Selecionar mês"
        />
      </div>

      {isLoading && <p className="text-gray-500">Carregando...</p>}

      {hasNoData && !isLoading && (
        <p className="text-gray-500">Nenhum dado encontrado para este período.</p>
      )}

      {dashboard && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total gastos */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-red-100 p-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total gastos</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(dashboard.totalExpenses)}</p>
              <p className="mt-1 text-xs text-gray-400">
                Pessoal: {formatCurrency(dashboard.totalUserExpenses)}
              </p>
            </div>

            {/* Renda */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-green-100 p-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Renda</span>
              </div>
              {dashboard.incomeAmount > 0 ? (
                <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(dashboard.incomeAmount)}</p>
              ) : (
                <p className="mt-3 text-2xl font-bold text-gray-400">R$ 0,00</p>
              )}
              <form onSubmit={handleSetIncome} className="mt-2 flex gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="5000,00"
                  className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-label="Valor da renda"
                />
                <button type="submit" disabled={setIncomeMutation.isPending}
                  className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  OK
                </button>
              </form>
            </div>

            {/* Saldo */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${dashboard.balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <DollarSign className={`h-5 w-5 ${dashboard.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <span className="text-sm font-medium text-gray-500">Saldo</span>
              </div>
              <p className={`mt-3 text-2xl font-bold ${dashboard.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dashboard.balance)}
              </p>
              {dashboard.incomeAmount > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  {Math.round((dashboard.totalExpenses / dashboard.incomeAmount) * 100)}% da renda
                </p>
              )}
            </div>

            {/* Gastos por forma de pagamento resumo */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Por tipo</span>
              </div>
              <div className="space-y-2">
                {(dashboard.expensesByPaymentMethod ?? []).map((pm) => {
                  const info = PAYMENT_METHOD_LABELS[pm.paymentMethod] ?? PAYMENT_METHOD_LABELS.outros
                  return (
                    <div key={pm.paymentMethod} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{info.label}</span>
                      <span className="text-xs font-semibold">{formatCurrency(pm.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Gráfico de pizza — Distribuição por categoria */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Gastos por categoria</h2>
              {(dashboard.expensesByCategory ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum dado disponível.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dashboard.expensesByCategory}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ categoryName, percentage }) =>
                        `${categoryName} (${(percentage ?? 0).toFixed(1)}%)`
                      }
                    >
                      {(dashboard.expensesByCategory ?? []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Valor']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Barra — Gastos por forma de pagamento */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Por forma de pagamento</h2>
              {(dashboard.expensesByPaymentMethod ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum dado disponível.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(dashboard.expensesByPaymentMethod ?? []).map((pm) => ({
                    name: PAYMENT_METHOD_LABELS[pm.paymentMethod]?.label ?? pm.paymentMethod,
                    valor: pm.amount / 100,
                    fill: PAYMENT_METHOD_LABELS[pm.paymentMethod]?.color ?? '#6b7280',
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                      {(dashboard.expensesByPaymentMethod ?? []).map((pm, i) => (
                        <Cell key={i} fill={PAYMENT_METHOD_LABELS[pm.paymentMethod]?.color ?? '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Gastos por dependente */}
          {(dashboard.expensesByDependent ?? []).length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Gastos por dependente</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(dashboard.expensesByDependent ?? []).map((dep) => (
                  <div key={dep.dependentId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">{dep.dependentName}</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(dep.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
