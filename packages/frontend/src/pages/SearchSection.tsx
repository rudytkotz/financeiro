import { useState } from 'react'
import { useTransactionSearch } from '@/hooks/useAnalytics'
import { useCategories } from '@/hooks/useCategories'
import { Search, X } from 'lucide-react'

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string) {
  return iso.split('-').reverse().join('/')
}

export default function SearchSection() {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useTransactionSearch(query)
  const { data: categories } = useCategories()
  const catName = (id: string | null) => (id ? (categories ?? []).find((c) => c.id === id)?.name ?? null : null)

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar em todas as transações (ex: Amazon, Uber...)"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm placeholder:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
        )}
      </div>

      {query.trim().length < 2 ? (
        <p className="py-10 text-center text-sm text-gray-400">Digite ao menos 2 letras para buscar em todo o histórico.</p>
      ) : isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : !data || data.count === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Nada encontrado para "{query}".</p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm text-gray-500">{data.count} resultado(s)</span>
            <span className="text-sm font-bold text-gray-800">Total em despesas: {fmt(data.total)}</span>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t.description}</p>
                    <p className="text-[11px] text-gray-400">
                      {fmtDate(t.date)}{catName(t.categoryId) ? ` · ${catName(t.categoryId)}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
