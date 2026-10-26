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
} from '@/hooks/useInvestments'
import type { RvPosition } from '@financeiro/shared'
import {
  TrendingUp, TrendingDown, PieChart as PieIcon, Plus, Trash2, Landmark,
  LineChart as LineIcon, Wallet, Percent,
} from 'lucide-react'
import NewRvModal from '@/components/investments/NewRvModal'
import NewRfModal from '@/components/investments/NewRfModal'
import RvTransactionsModal from '@/components/investments/RvTransactionsModal'

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
const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#ef4444', '#a855f7']

type Tab = 'rv' | 'rf'

export default function InvestmentsPage() {
  const { data: summary } = usePortfolioSummary()
  const { data: positions, isLoading: loadingRv } = useRvPositions()
  const { data: rfPositions, isLoading: loadingRf } = useRfPositions()
  const { data: allocation } = useAllocation()
  const { data: evolution } = useEvolution()
  const deleteMutation = useDeleteInvestment()

  const [rvModalOpen, setRvModalOpen] = useState(false)
  const [rfModalOpen, setRfModalOpen] = useState(false)
  const [txModalInvestment, setTxModalInvestment] = useState<RvPosition | null>(null)
  const [tab, setTab] = useState<Tab>('rv')

  const cdiAnnual = rfPositions?.[0]?.cdiAnnual ?? null

  const activeRv = useMemo(() => (positions ?? []).filter(p => p.quantity > 0), [positions])

  // Dados do gráfico de evolução
  const evolutionData = useMemo(() => {
    return (evolution ?? []).map(p => ({
      month: monthLabel(p.month),
      Aportado: p.invested / 100,
      'CDI (100%)': p.cdiProjected / 100,
    }))
  }, [evolution])

  // Dados do gráfico de alocação
  const allocationData = useMemo(() => {
    return (allocation ?? []).map(s => ({ name: s.label, value: s.value / 100, category: s.category }))
  }, [allocation])

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
        <div className="flex gap-2">
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
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
            <PieIcon className="h-4 w-4 text-emerald-500" /> Alocação da carteira
          </h2>
          {allocationData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Sem dados para exibir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {allocationData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Patrimônio vs CDI */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
            <Percent className="h-4 w-4 text-blue-500" /> Aportado vs CDI (100%)
          </h2>
          {evolutionData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Cadastre aportes para ver a comparação com o CDI.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Aportado" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="CDI (100%)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-[10px] text-gray-400">
            Compara o total aportado com o quanto renderia no CDI. Rentabilidade de RF é estimada.
          </p>
        </div>
      </div>

      {/* Abas RV / RF */}
      <div className="flex gap-2 border-b border-gray-100">
        <TabButton active={tab === 'rv'} onClick={() => setTab('rv')} icon={<LineIcon className="h-4 w-4" />} label={`Renda Variável (${activeRv.length})`} />
        <TabButton active={tab === 'rf'} onClick={() => setTab('rf')} icon={<Landmark className="h-4 w-4" />} label={`Renda Fixa (${(rfPositions ?? []).length})`} />
      </div>

      {tab === 'rv' && (
        <RvTable positions={activeRv} loading={loadingRv} onOperate={setTxModalInvestment}
          onDelete={(id, ticker) => { if (confirm(`Excluir ${ticker} e todas as operações?`)) deleteMutation.mutate(id) }} />
      )}

      {tab === 'rf' && (
        <RfTable positions={rfPositions ?? []} loading={loadingRf}
          onDelete={(id, name) => { if (confirm(`Excluir ${name}?`)) deleteMutation.mutate(id) }} />
      )}

      {/* Modais */}
      <NewRvModal open={rvModalOpen} onClose={() => setRvModalOpen(false)} />
      <NewRfModal open={rfModalOpen} onClose={() => setRfModalOpen(false)} />
      <RvTransactionsModal position={txModalInvestment} onClose={() => setTxModalInvestment(null)} />
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
