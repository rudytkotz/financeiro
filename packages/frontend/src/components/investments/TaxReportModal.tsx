import { useState } from 'react'
import { useTaxReport } from '@/hooks/useInvestments'
import { X, FileText, AlertTriangle } from 'lucide-react'

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CLASS_LABELS: Record<string, string> = {
  acao: 'Ações', fii: 'FIIs', etf: 'ETFs', bdr: 'BDRs', outro: 'Outros',
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m, 10) - 1]}/${y}`
}

export default function TaxReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: report, isLoading } = useTaxReport(year)

  if (!open) return null

  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-indigo-500" /> Relatório de Imposto de Renda
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Seletor de ano */}
        <div className="flex gap-2 mb-4">
          {years.map((y) => (
            <button key={y} onClick={() => setYear(y)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                year === y ? 'bg-indigo-500 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {y}
            </button>
          ))}
        </div>

        {/* Aviso */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Estimativa de apoio baseada em swing trade. Não considera day trade, compensação de prejuízo
            entre meses, nem eventos corporativos. Confira sempre com seu contador antes de emitir DARF.
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-500" /></div>
        ) : !report || report.rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Nenhuma venda registrada em {year}.</p>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Lucro total</p>
                <p className={`text-base font-bold ${report.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(report.totalProfit)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-600/70">Lucro isento</p>
                <p className="text-base font-bold text-emerald-700">{fmt(report.totalExemptProfit)}</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-indigo-600/70">Imposto devido</p>
                <p className="text-base font-bold text-indigo-700">{fmt(report.totalTaxDue)}</p>
              </div>
            </div>

            {/* Tabela por mês */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50/60 border-b border-gray-100">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-2 text-left">Mês</th>
                    <th className="px-3 py-2 text-left">Classe</th>
                    <th className="px-3 py-2 text-right">Vendas</th>
                    <th className="px-3 py-2 text-right">Lucro</th>
                    <th className="px-3 py-2 text-center">Situação</th>
                    <th className="px-3 py-2 text-right">Imposto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-600">{monthLabel(row.month)}</td>
                      <td className="px-3 py-2 text-gray-600">{CLASS_LABELS[row.assetClass] ?? row.assetClass}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmt(row.salesTotal)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(row.profit)}</td>
                      <td className="px-3 py-2 text-center">
                        {row.exempt ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">isento</span>
                        ) : row.profit <= 0 ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">prejuízo</span>
                        ) : (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{row.taxRate}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{row.taxDue > 0 ? fmt(row.taxDue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
