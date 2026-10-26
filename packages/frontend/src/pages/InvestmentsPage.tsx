import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  useRvPositions,
  useRfPositions,
  usePortfolioSummary,
  useAllocation,
  useEvolution,
  useDeleteInvestment,
  useDividends,
  useMaturityAlerts,
  useSnapshots,
  useRebalance,
  useDeleteDividend,
} from '@/hooks/useInvestments'
import type { RvPosition } from '@financeiro/shared'
import {
  TrendingUp, TrendingDown, PieChart as PieIcon, Plus, Trash2, Landmark,
  LineChart as LineIcon, Wallet, Percent, ChevronDown, Coins, Target, AlertTriangle,
} from 'lucide-react'
import NewRvModal from '@/components/investments/NewRvModal'
import NewRfModal from '@/components/investments/NewRfModal'
import RvTransactionsModal from '@/components/investments/RvTransactionsModal'
import DividendModal from '@/components/investments/DividendModal'
import TargetsModal from '@/components/investments/TargetsModal'

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtShort(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`
}

const RF_CLASS_LABELS: Record<string, string> = {
  cdb: 'CDB', tesouro: 'Tesouro Direto', lci: 'LCI', lca: 'LCA', debenture: 'Debênture', outro: 'Outro',
}
const RATE_TYPE_LABELS: Record<string, string> = {
  pos_cdi: 'do CDI', prefixado: 'a.a. (pré)', ipca_mais: '+ IPCA',
}
// Rótulos e ordem de exibição das classes de renda variável
const RV_CLASS_LABELS: Record<string, string> = {
  acao: 'Ações', fii: 'Fundos Imobiliários', etf: 'ETFs', bdr: 'BDRs', outro: 'Outros',
}
const RV_CLASS_ORDER = ['acao', 'fii', 'etf', 'bdr', 'outro']
const ALL_CLASS_LABELS: Record<string, string> = {
  acao: 'Ações', fii: 'Fundos Imobiliários', etf: 'ETFs', bdr: 'BDRs', outro: 'Outros', renda_fixa: 'Renda Fixa',
}
const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#ef4444', '#a855f7']

type Tab = 'rv' | 'rf'
type RvFilter = 'todos' | 'acao' | 'fii' | 'etf' | 'bdr'
type AllocationView = 'ativo' | 'classe'

export default function InvestmentsPage() {
  const { data: summary } = usePortfolioSummary()
  const { data: positions, isLoading: loadingRv } = useRvPositions()
  const { data: rfPositions, isLoading: loadingRf } = useRfPositions()
  const { data: allocation } = useAllocation()
  const { data: evolution } = useEvolution()
  const { data: dividends } = useDividends()
  const { data: maturityAlerts } = useMaturityAlerts()
  const { data: snapshots } = useSnapshots()
  const { data: rebalance } = useRebalance()
  const deleteMutation = useDeleteInvestment()
  const deleteDividendMutation = useDeleteDividend()

  const [rvModalOpen, setRvModalOpen] = useState(false)
  const [rfModalOpen, setRfModalOpen] = useState(false)
  const [dividendModalOpen, setDividendModalOpen] = useState(false)
  const [targetsModalOpen, setTargetsModalOpen] = useState(false)
  const [txModalInvestment, setTxModalInvestment] = useState<RvPosition | null>(null)
  const [tab, setTab] = useState<Tab>('rv')
  const [rvFilter, setRvFilter] = useState<RvFilter>('todos')
  const [allocationView, setAllocationView] = useState<AllocationView>('classe')
  // Classes recolhidas (Set de classKey). Começam todas expandidas.
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set())

  const toggleClass = (classKey: string) => {
    setCollapsedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(classKey)) next.delete(classKey)
      else next.add(classKey)
      return next
    })
  }

  const cdiAnnual = rfPositions?.[0]?.cdiAnnual ?? null

  const activeRv = useMemo(() => (positions ?? []).filter(p => p.quantity > 0), [positions])

  // Classes de RV presentes na carteira (para mostrar só os filtros relevantes)
  const presentClasses = useMemo(() => {
    const set = new Set<string>()
    for (const p of activeRv) set.add(p.investment.assetClass ?? 'outro')
    return RV_CLASS_ORDER.filter(c => set.has(c))
  }, [activeRv])

  // RV filtrado
  const filteredRv = useMemo(() => {
    if (rvFilter === 'todos') return activeRv
    return activeRv.filter(p => (p.investment.assetClass ?? 'outro') === rvFilter)
  }, [activeRv, rvFilter])

  // RV agrupado por classe (só classes com ativos)
  const rvByClass = useMemo(() => {
    const groups = new Map<string, RvPosition[]>()
    for (const p of filteredRv) {
      const cls = p.investment.assetClass ?? 'outro'
      const arr = groups.get(cls) ?? []
      arr.push(p)
      groups.set(cls, arr)
    }
    return RV_CLASS_ORDER
      .filter(c => groups.has(c))
      .map(c => ({ classKey: c, label: RV_CLASS_LABELS[c] ?? c, positions: groups.get(c)! }))
  }, [filteredRv])

  // Dados do gráfico de evolução.
  // Usa snapshots reais quando houver (>= 2 meses); senão cai no cálculo aportado vs CDI.
  const useSnapshotData = (snapshots ?? []).length >= 2
  const evolutionData = useMemo(() => {
    if (useSnapshotData) {
      return (snapshots ?? []).map(s => ({
        month: monthLabel(s.month),
        Patrimônio: s.totalCurrent / 100,
        Aportado: s.totalInvested / 100,
      }))
    }
    return (evolution ?? []).map(p => ({
      month: monthLabel(p.month),
      Aportado: p.invested / 100,
      'CDI (100%)': p.cdiProjected / 100,
    }))
  }, [evolution, snapshots, useSnapshotData])

  // Dados do gráfico de dividendos (12 meses)
  const dividendChartData = useMemo(() => {
    return (dividends?.byMonth ?? []).map(d => ({ month: monthLabel(d.month), valor: d.amount / 100 }))
  }, [dividends])

  // Dados do gráfico de alocação
  const allocationData = useMemo(() => {
    const slices = allocation ?? []
    if (slices.length === 0) return []

    if (allocationView === 'classe') {
      // Agrupar por classe (renda variável x renda fixa, mais granular)
      const byClass = new Map<string, number>()
      for (const s of slices) {
        const key = s.category === 'renda_fixa' ? 'Renda Fixa' : 'Renda Variável'
        byClass.set(key, (byClass.get(key) ?? 0) + s.value)
      }
      return [...byClass.entries()]
        .map(([name, value]) => ({ name, value: value / 100 }))
        .sort((a, b) => b.value - a.value)
    }

    // Por ativo — se tiver muitos, mostra top 8 e agrupa o resto em "Outros"
    const sorted = [...slices].sort((a, b) => b.value - a.value)
    const TOP_N = 8
    if (sorted.length <= TOP_N) {
      return sorted.map(s => ({ name: s.label, value: s.value / 100 }))
    }
    const top = sorted.slice(0, TOP_N)
    const rest = sorted.slice(TOP_N)
    const restTotal = rest.reduce((sum, s) => sum + s.value, 0)
    return [
      ...top.map(s => ({ name: s.label, value: s.value / 100 })),
      { name: `Outros (${rest.length})`, value: restTotal / 100 },
    ]
  }, [allocation, allocationView])

  const allocationTotal = useMemo(() => allocationData.reduce((sum, s) => sum + s.value, 0), [allocationData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5">
            <LineIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Investimentos</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Carteira completa de renda fixa e variável
              {cdiAnnual !== null && <span className="ml-1 text-emerald-600 font-medium">· CDI {cdiAnnual.toFixed(2)}% a.a.</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTargetsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95">
            <Target className="h-4 w-4" /> Metas
          </button>
          <button onClick={() => setDividendModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95">
            <Coins className="h-4 w-4" /> Provento
          </button>
          <button onClick={() => setRfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95">
            <Landmark className="h-4 w-4" /> Renda fixa
          </button>
          <button onClick={() => setRvModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition active:scale-95">
            <Plus className="h-4 w-4" /> Renda variável
          </button>
        </div>
      </div>

      {/* Alertas de vencimento */}
      {(maturityAlerts ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-800">Vencimentos próximos</span>
          </div>
          <div className="space-y-1.5">
            {(maturityAlerts ?? []).map((a) => (
              <div key={a.investmentId} className="flex items-center justify-between text-xs text-amber-700">
                <span className="font-medium">{a.name}</span>
                <span>
                  {a.daysUntil === 0 ? 'vence hoje' : `em ${a.daysUntil} dia${a.daysUntil > 1 ? 's' : ''}`}
                  {' · '}{fmt(a.investedAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards resumo */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<Wallet className="h-5 w-5 text-emerald-500" />} iconBg="bg-emerald-50"
            border="border-l-emerald-400" label="Patrimônio"
            value={fmt(summary.totalCurrent)} sub={`Investido: ${fmt(summary.totalInvested)}`} />
          <SummaryCard
            icon={summary.totalProfitLoss >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
            iconBg={summary.totalProfitLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
            border={summary.totalProfitLoss >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}
            label="Resultado"
            value={<span className={summary.totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(summary.totalProfitLoss)}</span>}
            sub={<span className={summary.totalProfitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>{fmtPct(summary.totalProfitLossPct)}</span>} />
          <SummaryCard
            icon={<LineIcon className="h-5 w-5 text-blue-500" />} iconBg="bg-blue-50"
            border="border-l-blue-400" label="Renda variável" value={fmt(summary.rendaVariavelTotal)} />
          <SummaryCard
            icon={<Landmark className="h-5 w-5 text-violet-500" />} iconBg="bg-violet-50"
            border="border-l-violet-400" label="Renda fixa" value={fmt(summary.rendaFixaTotal)} />
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alocação */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <PieIcon className="h-4 w-4 text-emerald-500" /> Alocação da carteira
            </h2>
            {/* Toggle classe / ativo */}
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-[11px] font-medium">
              <button onClick={() => setAllocationView('classe')}
                className={`rounded-md px-2.5 py-1 transition ${allocationView === 'classe' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Por classe
              </button>
              <button onClick={() => setAllocationView('ativo')}
                className={`rounded-md px-2.5 py-1 transition ${allocationView === 'ativo' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Por ativo
              </button>
            </div>
          </div>
          {allocationData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Sem dados para exibir.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220} className="sm:!w-1/2">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {allocationData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legenda customizada com valores e % */}
              <div className="w-full sm:w-1/2 space-y-1.5 max-h-[220px] overflow-y-auto">
                {allocationData.map((s, i) => {
                  const pct = allocationTotal > 0 ? (s.value / allocationTotal) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600 truncate flex-1">{s.name}</span>
                      <span className="text-gray-400">{pct.toFixed(1)}%</span>
                      <span className="font-semibold text-gray-700 tabular-nums">
                        R$ {s.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Evolução: patrimônio real (snapshots) ou aportado vs CDI */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
            <Percent className="h-4 w-4 text-blue-500" />
            {useSnapshotData ? 'Evolução do patrimônio' : 'Aportado vs CDI (100%)'}
          </h2>
          {evolutionData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Cadastre aportes para ver a evolução.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {useSnapshotData ? (
                  <>
                    <Line type="monotone" dataKey="Patrimônio" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Aportado" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </>
                ) : (
                  <>
                    <Line type="monotone" dataKey="Aportado" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="CDI (100%)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-[10px] text-gray-400">
            {useSnapshotData
              ? 'Patrimônio real registrado mês a mês vs total aportado.'
              : 'Compara o aportado com o CDI. Snapshots mensais reais serão usados após 2 meses de uso.'}
          </p>
        </div>
      </div>

      {/* Proventos + Rebalanceamento */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Proventos */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Coins className="h-4 w-4 text-amber-500" /> Proventos
            </h2>
            {dividends && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">DY carteira · YoC</p>
                <p className="text-xs font-bold text-amber-600">{dividends.portfolioYield.toFixed(2)}% · {dividends.yieldOnCost.toFixed(2)}%</p>
              </div>
            )}
          </div>
          {!dividends || dividends.dividends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhum provento registrado. Clique em "Provento" no topo para adicionar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-600/70">Últimos 12 meses</p>
                  <p className="text-base font-bold text-amber-700">{fmt(dividends.totalLast12m)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Total recebido</p>
                  <p className="text-base font-bold text-gray-700">{fmt(dividends.totalReceived)}</p>
                </div>
              </div>
              {dividendChartData.some(d => d.valor > 0) && (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={dividendChartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    <Line type="monotone" dataKey="valor" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <ul className="mt-2 divide-y divide-gray-50 max-h-[140px] overflow-y-auto">
                {dividends.dividends.slice(0, 20).map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-1.5 text-xs group">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">{d.ticker}</span>
                      <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] uppercase text-gray-400">{d.kind}</span>
                      <span className="text-gray-400">{d.date.split('-').reverse().join('/')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-amber-600">{fmt(d.amount)}</span>
                      <button onClick={() => { if (confirm('Excluir provento?')) deleteDividendMutation.mutate(d.id) }}
                        className="rounded p-1 text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Rebalanceamento */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Target className="h-4 w-4 text-blue-500" /> Rebalanceamento
            </h2>
            <button onClick={() => setTargetsModalOpen(true)} className="text-xs font-medium text-blue-600 hover:underline">
              Editar metas
            </button>
          </div>
          {!rebalance || rebalance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Defina metas de alocação para ver sugestões de aporte.
            </p>
          ) : (
            <div className="space-y-2.5">
              {rebalance.map((row) => {
                const onTarget = Math.abs(row.diffPct) < 1
                return (
                  <div key={row.assetClass} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{ALL_CLASS_LABELS[row.assetClass] ?? row.assetClass}</span>
                      <span className="text-gray-400">{row.currentPct.toFixed(1)}% / {row.targetPct.toFixed(0)}%</span>
                    </div>
                    {/* Barra dupla: atual vs alvo */}
                    <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-blue-400" style={{ width: `${Math.min(row.currentPct, 100)}%` }} />
                      <div className="absolute inset-y-0 w-0.5 bg-gray-700" style={{ left: `${Math.min(row.targetPct, 100)}%` }} title="Meta" />
                    </div>
                    <div className="flex justify-end text-[11px]">
                      {onTarget ? (
                        <span className="text-emerald-600 font-medium">no alvo</span>
                      ) : row.suggestedAmount > 0 ? (
                        <span className="text-blue-600">aportar {fmt(row.suggestedAmount)}</span>
                      ) : (
                        <span className="text-amber-600">reduzir {fmt(Math.abs(row.suggestedAmount))}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Abas RV / RF */}
      <div className="flex gap-2 border-b border-gray-100">
        <TabButton active={tab === 'rv'} onClick={() => setTab('rv')} icon={<LineIcon className="h-4 w-4" />} label={`Renda Variável (${activeRv.length})`} />
        <TabButton active={tab === 'rf'} onClick={() => setTab('rf')} icon={<Landmark className="h-4 w-4" />} label={`Renda Fixa (${(rfPositions ?? []).length})`} />
      </div>

      {tab === 'rv' && (
        <div className="space-y-4">
          {/* Filtro por classe — só mostra os presentes */}
          {activeRv.length > 0 && presentClasses.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip active={rvFilter === 'todos'} onClick={() => setRvFilter('todos')} label={`Todos (${activeRv.length})`} />
              {presentClasses.map((cls) => {
                const count = activeRv.filter(p => (p.investment.assetClass ?? 'outro') === cls).length
                return (
                  <FilterChip key={cls} active={rvFilter === cls} onClick={() => setRvFilter(cls as RvFilter)}
                    label={`${RV_CLASS_LABELS[cls] ?? cls} (${count})`} />
                )
              })}
            </div>
          )}

          {loadingRv ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-500" /></div>
          ) : activeRv.length === 0 ? (
            <EmptyState text='Nenhuma posição de renda variável. Clique em "Renda variável" para adicionar.' />
          ) : rvByClass.length === 0 ? (
            <EmptyState text="Nenhum ativo nesta categoria." />
          ) : (
            rvByClass.map((group) => {
              const collapsed = collapsedClasses.has(group.classKey)
              const groupTotal = group.positions.reduce((s, p) => s + (p.currentvalueTotal ?? p.investedTotal), 0)
              const groupResult = group.positions.reduce((s, p) => s + (p.profitLoss ?? 0), 0)
              return (
                <div key={group.classKey} className="space-y-2">
                  <button
                    onClick={() => toggleClass(group.classKey)}
                    className="flex w-full items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-left transition hover:bg-gray-100/60"
                  >
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{group.label}</span>
                    <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{group.positions.length}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {groupResult !== 0 && (
                        <span className={`text-[11px] font-medium ${groupResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {groupResult >= 0 ? '+' : ''}{fmtShort(groupResult)}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-700">{fmt(groupTotal)}</span>
                    </span>
                  </button>
                  {!collapsed && (
                    <RvTable positions={group.positions} loading={false} onOperate={setTxModalInvestment}
                      onDelete={(id, ticker) => { if (confirm(`Excluir ${ticker} e todas as operações?`)) deleteMutation.mutate(id) }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'rf' && (
        <RfTable positions={rfPositions ?? []} loading={loadingRf}
          onDelete={(id, name) => { if (confirm(`Excluir ${name}?`)) deleteMutation.mutate(id) }} />
      )}

      {/* Modais */}
      <NewRvModal open={rvModalOpen} onClose={() => setRvModalOpen(false)} />
      <NewRfModal open={rfModalOpen} onClose={() => setRfModalOpen(false)} />
      <RvTransactionsModal position={txModalInvestment} onClose={() => setTxModalInvestment(null)} />
      <DividendModal open={dividendModalOpen} onClose={() => setDividendModalOpen(false)} />
      <TargetsModal open={targetsModalOpen} onClose={() => setTargetsModalOpen(false)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function SummaryCard({ icon, iconBg, border, label, value, sub }: {
  icon: React.ReactNode; iconBg: string; border: string; label: string
  value: React.ReactNode; sub?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border border-l-4 ${border} bg-white p-4 shadow-sm`}>
      <div className="flex items-center gap-2">
        <div className={`rounded-lg ${iconBg} p-2`}>{icon}</div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-gray-900 md:text-xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
        active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
      }`}>
      {label}
    </button>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
        active ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}>
      {icon} {label}
    </button>
  )
}

function RvTable({ positions, loading, onOperate, onDelete }: {
  positions: RvPosition[]; loading: boolean
  onOperate: (p: RvPosition) => void; onDelete: (id: string, ticker: string) => void
}) {
  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-500" /></div>
  if (positions.length === 0) return <EmptyState text='Nenhuma posição de renda variável. Clique em "Renda variável" para adicionar.' />

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-gray-50/60 border-b border-gray-100">
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 text-left">Ativo</th>
            <th className="px-4 py-3 text-right">Qtd</th>
            <th className="px-4 py-3 text-right">Preço médio</th>
            <th className="px-4 py-3 text-right">Cotação</th>
            <th className="px-4 py-3 text-right">Valor atual</th>
            <th className="px-4 py-3 text-right">Resultado</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {positions.map((pos) => (
            <tr key={pos.investment.id} className="hover:bg-gray-50/50 transition group">
              <td className="px-4 py-3">
                <div className="font-semibold text-gray-800">{pos.investment.ticker}</div>
                <div className="text-[11px] text-gray-400 truncate max-w-[160px]">{pos.investment.name}</div>
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{pos.quantity}</td>
              <td className="px-4 py-3 text-right text-gray-600">{fmt(pos.averagePrice)}</td>
              <td className="px-4 py-3 text-right text-gray-600">
                {pos.currentPrice !== null ? fmt(pos.currentPrice) : <span className="text-gray-300">s/ cotação</span>}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-800">
                {pos.currentvalueTotal !== null ? fmt(pos.currentvalueTotal) : fmt(pos.investedTotal)}
              </td>
              <td className="px-4 py-3 text-right">
                {pos.profitLoss !== null ? (
                  <div className={pos.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    <div className="font-semibold">{fmt(pos.profitLoss)}</div>
                    <div className="text-[11px]">{fmtPct(pos.profitLossPct)}</div>
                  </div>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-2 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onOperate(pos)}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 transition">Operar</button>
                  <button onClick={() => onDelete(pos.investment.id, pos.investment.ticker ?? '')}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RfTable({ positions, loading, onDelete }: {
  positions: Array<import('@financeiro/shared').RfPosition>; loading: boolean
  onDelete: (id: string, name: string) => void
}) {
  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-500" /></div>
  if (positions.length === 0) return <EmptyState text='Nenhum investimento de renda fixa. Clique em "Renda fixa" para adicionar.' />

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-gray-50/60 border-b border-gray-100">
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 text-left">Ativo</th>
            <th className="px-4 py-3 text-left">Taxa</th>
            <th className="px-4 py-3 text-right">Aplicado</th>
            <th className="px-4 py-3 text-right">Valor atual</th>
            <th className="px-4 py-3 text-right">Rendimento</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {positions.map((pos) => {
            const inv = pos.investment
            const rateLabel = inv.rateValue !== null
              ? `${(inv.rateValue / 100).toFixed(2)}% ${RATE_TYPE_LABELS[inv.rateType ?? ''] ?? ''}`
              : '—'
            return (
              <tr key={inv.id} className="hover:bg-gray-50/50 transition group">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-800">{inv.name}</div>
                  <div className="text-[11px] text-gray-400">
                    {RF_CLASS_LABELS[inv.assetClass ?? 'outro']}
                    {inv.maturityDate && ` · vence ${inv.maturityDate.split('-').reverse().join('/')}`}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{rateLabel}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(pos.investedAmount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(pos.currentValue)}</td>
                <td className="px-4 py-3 text-right">
                  <div className={pos.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    <div className="font-semibold">{fmt(pos.profitLoss)}</div>
                    <div className="text-[11px]">{fmtPct(pos.profitLossPct)}</div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right">
                  <button onClick={() => onDelete(inv.id, inv.name)}
                    className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-gray-400 text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
      {text}
    </p>
  )
}
