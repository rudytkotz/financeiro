import { useState } from 'react'
import {
  useRvPositions,
  usePortfolioSummary,
  useInvestments,
  useDeleteInvestment,
} from '@/hooks/useInvestments'
import type { RvPosition, Investment } from '@financeiro/shared'
import {
  TrendingUp, TrendingDown, PieChart, Plus, Trash2, Landmark, LineChart, Wallet,
} from 'lucide-react'
import NewRvModal from '@/components/investments/NewRvModal'
import NewRfModal from '@/components/investments/NewRfModal'
import RvTransactionsModal from '@/components/investments/RvTransactionsModal'

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

const RF_CLASS_LABELS: Record<string, string> = {
  cdb: 'CDB', tesouro: 'Tesouro Direto', lci: 'LCI', lca: 'LCA', debenture: 'Debênture', outro: 'Outro',
}
const RATE_TYPE_LABELS: Record<string, string> = {
  pos_cdi: 'do CDI', prefixado: 'a.a. (pré)', ipca_mais: '+ IPCA',
}

export default function InvestmentsPage() {
  const { data: summary } = usePortfolioSummary()
  const { data: positions, isLoading: loadingRv } = useRvPositions()
  const { data: allInvestments } = useInvestments()
  const deleteMutation = useDeleteInvestment()

  const [rvModalOpen, setRvModalOpen] = useState(false)
  const [rfModalOpen, setRfModalOpen] = useState(false)
  const [txModalInvestment, setTxModalInvestment] = useState<RvPosition | null>(null)

  const rfInvestments = (allInvestments ?? []).filter((i) => i.type === 'renda_fixa')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5">
            <LineChart className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Investimentos</h1>
            <p className="text-xs text-gray-400 mt-0.5">Acompanhe sua carteira de renda fixa e variável</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
          >
            <Landmark className="h-4 w-4" /> Renda fixa
          </button>
          <button
            onClick={() => setRvModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition active:scale-95"
          >
            <Plus className="h-4 w-4" /> Renda variável
          </button>
        </div>
      </div>

      {/* Resumo da carteira */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-l-4 border-l-emerald-400 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 p-2"><Wallet className="h-5 w-5 text-emerald-500" /></div>
              <span className="text-sm font-medium text-gray-500">Patrimônio</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(summary.totalCurrent)}</p>
            <p className="mt-1 text-xs text-gray-400">Investido: {formatCurrency(summary.totalInvested)}</p>
          </div>

          <div className={`rounded-xl border border-l-4 bg-white p-5 shadow-sm ${summary.totalProfitLoss >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${summary.totalProfitLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {summary.totalProfitLoss >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
              </div>
              <span className="text-sm font-medium text-gray-500">Resultado</span>
            </div>
            <p className={`mt-3 text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfitLoss)}
            </p>
            <p className={`mt-1 text-xs ${summary.totalProfitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatPct(summary.totalProfitLossPct)}
            </p>
          </div>

          <div className="rounded-xl border border-l-4 border-l-blue-400 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2"><LineChart className="h-5 w-5 text-blue-500" /></div>
              <span className="text-sm font-medium text-gray-500">Renda variável</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(summary.rendaVariavelTotal)}</p>
          </div>

          <div className="rounded-xl border border-l-4 border-l-violet-400 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-50 p-2"><Landmark className="h-5 w-5 text-violet-500" /></div>
              <span className="text-sm font-medium text-gray-500">Renda fixa</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{formatCurrency(summary.rendaFixaTotal)}</p>
          </div>
        </div>
      )}

      {/* Renda Variável */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <PieChart className="h-4 w-4 text-emerald-500" /> Renda Variável
        </h2>

        {loadingRv ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-500" /></div>
        ) : (positions ?? []).filter(p => p.quantity > 0).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
            Nenhuma posição de renda variável. Clique em "Renda variável" para adicionar.
          </p>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50/60 border-b border-gray-100">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 text-left">Ativo</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Preço médio</th>
                  <th className="px-4 py-3 text-right">Cotação</th>
                  <th className="px-4 py-3 text-right">Valor atual</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(positions ?? []).filter(p => p.quantity > 0).map((pos) => (
                  <tr key={pos.investment.id} className="hover:bg-gray-50/50 transition group">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{pos.investment.ticker}</div>
                      <div className="text-[11px] text-gray-400">{pos.investment.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{pos.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(pos.averagePrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {pos.currentPrice !== null ? formatCurrency(pos.currentPrice) : <span className="text-gray-300">s/ cotação</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {pos.currentvalueTotal !== null ? formatCurrency(pos.currentvalueTotal) : formatCurrency(pos.investedTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pos.profitLoss !== null ? (
                        <div className={pos.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          <div className="font-semibold">{formatCurrency(pos.profitLoss)}</div>
                          <div className="text-[11px]">{formatPct(pos.profitLossPct)}</div>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setTxModalInvestment(pos)}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 transition"
                          title="Operações"
                        >
                          Operar
                        </button>
                        <button
                          onClick={() => { if (confirm(`Excluir ${pos.investment.ticker} e todas as operações?`)) deleteMutation.mutate(pos.investment.id) }}
                          className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                          title="Excluir ativo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Renda Fixa */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Landmark className="h-4 w-4 text-violet-500" /> Renda Fixa
        </h2>

        {rfInvestments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
            Nenhum investimento de renda fixa cadastrado.
          </p>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-50">
              {rfInvestments.map((inv) => (
                <RfRow key={inv.id} inv={inv} onDelete={() => { if (confirm(`Excluir ${inv.name}?`)) deleteMutation.mutate(inv.id) }} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Modais */}
      <NewRvModal open={rvModalOpen} onClose={() => setRvModalOpen(false)} />
      <NewRfModal open={rfModalOpen} onClose={() => setRfModalOpen(false)} />
      <RvTransactionsModal position={txModalInvestment} onClose={() => setTxModalInvestment(null)} />
    </div>
  )
}

function RfRow({ inv, onDelete }: { inv: Investment; onDelete: () => void }) {
  const rateLabel = inv.rateValue !== null
    ? `${(inv.rateValue / 100).toFixed(2)}% ${RATE_TYPE_LABELS[inv.rateType ?? ''] ?? ''}`
    : '—'

  return (
    <li className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition group">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-[10px] font-bold text-violet-600">
          {RF_CLASS_LABELS[inv.assetClass ?? 'outro']?.slice(0, 3).toUpperCase() ?? 'RF'}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">{inv.name}</div>
          <div className="text-[11px] text-gray-400">
            {RF_CLASS_LABELS[inv.assetClass ?? 'outro']} · {rateLabel}
            {inv.maturityDate && ` · vence ${inv.maturityDate.split('-').reverse().join('/')}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-800">
          {inv.investedAmount !== null ? (inv.investedAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
        </span>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}
