import { useState, FormEvent } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useSetIncome } from '@/hooks/useMutations'

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

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
    // Validação: R$ 0,01 (1 centavo) a R$ 999.999.999,99 (99999999999 centavos)
    if (cents < 1 || cents > 99999999999) return
    setIncomeMutation.mutate(
      { month, payload: { amount: cents } },
      { onSuccess: () => setIncomeInput('') }
    )
  }

  const hasNoData =
    dashboard &&
    dashboard.totalUserExpenses === 0 &&
    dashboard.incomeAmount === null &&
    (dashboard.expensesByCategory ?? []).length === 0 &&
    (dashboard.expensesByDependent ?? []).length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Selecionar mês"
        />
      </div>

      {isLoading && (
        <p className="text-gray-500">Carregando...</p>
      )}

      {hasNoData && (
        <p className="text-gray-500">
          Nenhum dado encontrado para este período.
        </p>
      )}

      {dashboard && !isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card Total de gastos */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500">Total de gastos</h2>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(dashboard.totalUserExpenses)}
            </p>
          </div>

          {/* Card Renda */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500">Renda</h2>
            {dashboard.incomeAmount !== null ? (
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(dashboard.incomeAmount)}
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-2xl font-bold text-gray-400">–</p>
                <p className="mt-1 text-xs text-gray-500">
                  Informe sua renda para visualizar o saldo do mês.
                </p>
              </div>
            )}
            <form onSubmit={handleSetIncome} className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                placeholder="Ex: 5000,00"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Valor da renda"
              />
              <button
                type="submit"
                disabled={setIncomeMutation.isPending}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {setIncomeMutation.isPending ? '...' : 'Salvar'}
              </button>
            </form>
          </div>

          {/* Card Saldo */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500">Saldo</h2>
            {dashboard.balance !== null ? (
              <p
                className={`mt-2 text-2xl font-bold ${
                  dashboard.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(dashboard.balance)}
              </p>
            ) : (
              <p className="mt-2 text-2xl font-bold text-gray-400">–</p>
            )}
          </div>
        </div>
      )}

      {/* Gráfico de pizza — Distribuição por categoria */}
      {dashboard && !isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Gastos por categoria
          </h2>
          {(dashboard.expensesByCategory ?? []).length === 0 ? (
            <p className="text-gray-500">Nenhum dado disponível para o período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={dashboard.expensesByCategory}
                  dataKey="amount"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ categoryName, percentage }) =>
                    `${categoryName} (${(percentage ?? 0).toFixed(1)}%)`
                  }
                >
                  {(dashboard.expensesByCategory ?? []).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Lista de gastos por dependente */}
      {dashboard && !isLoading && (dashboard.expensesByDependent ?? []).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Gastos por dependente
          </h2>
          <ul className="divide-y divide-gray-100">
            {dashboard.expensesByDependent.map((dep) => (
              <li
                key={dep.dependentId}
                className="flex items-center justify-between py-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {dep.dependentName}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(dep.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
