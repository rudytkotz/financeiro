import { useNavigate } from 'react-router-dom'
import { useImports } from '@/hooks/useImports'
import { History, ArrowRight, Package } from 'lucide-react'

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return `${months[parseInt(m, 10) - 1]} ${year}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ImportsHistoryPage() {
  const { data: imports, isLoading } = useImports()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <History className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Histórico de Importações</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {(imports ?? []).length} importação(ões) registrada(s)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      ) : (imports ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-gray-100 p-5 mb-4">
            <Package className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">Nenhuma importação encontrada</p>
          <p className="text-xs text-gray-400 mt-1">Importe uma fatura CSV para começar</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {(imports ?? []).map((imp) => (
              <li key={imp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition group">
                {/* Ícone mês */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-[10px] font-bold text-primary leading-tight text-center">
                    {imp.referenceMonth.split('-')[1]}<br />
                    <span className="text-[9px] font-medium text-primary/70">{imp.referenceMonth.split('-')[0]}</span>
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {formatMonthLabel(imp.referenceMonth)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {imp.transactionCount} transação(ões) · importado em {formatDate(imp.importedAt)}
                  </p>
                </div>

                {/* Botão ver transações */}
                <button
                  onClick={() => navigate('/transactions', { state: { month: imp.referenceMonth } })}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 hover:border-primary/30 hover:text-primary transition"
                  title="Ver transações do mês"
                >
                  Ver transações
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
