import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useDependents } from '@/hooks/useDependents'
import { useSetIncome } from '@/hooks/useMutations'
import { CreditCard, Smartphone, Wallet, Banknote, TrendingDown, TrendingUp, DollarSign, SlidersHorizontal } from 'lucide-react'

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
  const [catDependentId, setCatDependentId] = useState('')
  const [catPaymentMethod, setCatPaymentMethod] = useState('')
  const { data: dashboard, isLoading } = useDashboard({
    month,
    dependentId: catDependentId || undefined,
    paymentMethod: catPaymentMethod || undefined,
  })
  const { data: dependents } = useDependents()

  const hasNoData =
    dashboard &&
    dashboard.totalExpenses === 0 &&
    dashboard.incomeAmount === 0

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

      {/* Telegram Bot info — always visible */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-500 p-3 shadow-md">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800">Lance gastos pelo Telegram!</h3>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">
              Envie mensagens para o bot e lance transações sem abrir o app.
            </p>
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] text-gray-500"><span className="font-semibold text-gray-700">1.</span> Abra o bot: <a href="https://t.me/Riiquinho_bot" target="_blank" rel="noopener noreferrer" className="font-mono bg-white px-1.5 py-0.5 rounded text-blue-600 text-[10px] hover:underline">@Riiquinho_bot</a></p>
              <p className="text-[11px] text-gray-500"><span className="font-semibold text-gray-700">2.</span> Vincule: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px]">/vincular seuusuario suasenha</span></p>
              <p className="text-[11px] text-gray-500"><span className="font-semibold text-gray-700">3.</span> Lance: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px]">150,50 ifood</span> ou <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px]">pix 800 aluguel</span></p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-block rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">💳 credito (padrão)</span>
              <span className="inline-block rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">📱 pix</span>
              <span className="inline-block rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">👛 deb</span>
              <span className="inline-block rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">💵 din</span>
            </div>
          </div>
        </div>
      </div>

      {dashboard && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total gastos */}
            <div className="rounded-xl border border-l-4 border-l-red-400 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-red-50 p-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total gastos</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(dashboard.totalExpenses)}</p>
              <p className="mt-1 text-xs text-gray-400">
                Pessoal: {formatCurrency(dashboard.totalUserExpenses)}
              </p>
            </div>

            {/* Renda */}
            <IncomeCard incomeAmount={dashboard.incomeAmount} month={month} />

            {/* Saldo */}
            <div className={`rounded-xl border border-l-4 bg-white p-5 shadow-sm ${dashboard.balance >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${dashboard.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <DollarSign className={`h-5 w-5 ${dashboard.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <span className="text-sm font-medium text-gray-500">Saldo</span>
              </div>
              <p className={`mt-3 text-2xl font-bold ${dashboard.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(dashboard.balance)}
              </p>
              {dashboard.incomeAmount > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  {Math.round((dashboard.totalExpenses / dashboard.incomeAmount) * 100)}% da renda
                </p>
              )}
            </div>

            {/* Gastos por forma de pagamento resumo */}
            <div className="rounded-xl border border-l-4 border-l-primary/50 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CreditCard className="h-5 w-5 text-primary" />
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
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold text-gray-900">Gastos por categoria</h2>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  {/* Filtro por dependente */}
                  <select
                    value={catDependentId}
                    onChange={(e) => setCatDependentId(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Filtrar por dependente"
                  >
                    <option value="">Todos os dependentes</option>
                    <option value="none">Pessoal (sem dependente)</option>
                    {(dependents ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {/* Filtro por forma de pagamento */}
                  <select
                    value={catPaymentMethod}
                    onChange={(e) => setCatPaymentMethod(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Filtrar por forma de pagamento"
                  >
                    <option value="">Todas as formas</option>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
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

// ---------------------------------------------------------------------------
// Inline editable income card
// ---------------------------------------------------------------------------

function IncomeCard({ incomeAmount, month }: { incomeAmount: number; month: string }) {
  const [display, setDisplay] = useState(() => (incomeAmount / 100).toFixed(2).replace('.', ','))
  const setIncomeMutation = useSetIncome()

  // Sync display when prop changes (month navigation)
  const [prevAmount, setPrevAmount] = useState(incomeAmount)
  if (incomeAmount !== prevAmount) {
    setPrevAmount(incomeAmount)
    setDisplay((incomeAmount / 100).toFixed(2).replace('.', ','))
  }

  const handleSave = () => {
    const cleaned = display.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
    const num = Number(cleaned)
    if (isNaN(num) || num < 0) return
    const cents = Math.round(num * 100)
    if (cents === incomeAmount) return
    if (cents === 0) return // mantém zero se limpar
    setIncomeMutation.mutate({ month, payload: { amount: cents } })
  }

  return (
    <div className="rounded-xl border border-l-4 border-l-emerald-400 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-green-100 p-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>
        <span className="text-sm font-medium text-gray-500">Renda</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-sm text-gray-400">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => setDisplay(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-full text-2xl font-bold text-gray-900 border-b border-transparent bg-transparent focus:border-green-500 focus:outline-none transition hover:border-gray-300"
          aria-label="Valor da renda"
        />
      </div>
      <p className="mt-1 text-[10px] text-gray-400">Clique para editar</p>
    </div>
  )
}
