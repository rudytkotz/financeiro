import { useState, useEffect } from 'react'
import { useCreateRvInvestment, useQuotePreview } from '@/hooks/useInvestments'
import type { RvAssetClass } from '@financeiro/shared'
import { X, TrendingUp } from 'lucide-react'

const ASSET_CLASSES: Array<{ value: RvAssetClass; label: string }> = [
  { value: 'acao', label: 'Ação' },
  { value: 'fii', label: 'FII' },
  { value: 'etf', label: 'ETF' },
  { value: 'bdr', label: 'BDR' },
  { value: 'cripto', label: 'Cripto' },
  { value: 'moeda', label: 'Moeda' },
]

// Classes cujas cotações vêm de símbolos "crus" do Yahoo (sem .SA)
const GENERIC_CLASSES = new Set<RvAssetClass>(['cripto', 'moeda'])

function brlToCents(value: string): number | null {
  const n = Number(value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

export default function NewRvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateRvInvestment()
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [nameEditedManually, setNameEditedManually] = useState(false)
  const [assetClass, setAssetClass] = useState<RvAssetClass>('acao')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const isGeneric = GENERIC_CLASSES.has(assetClass)
  const { data: quote, isFetching: loadingQuote, isError: quoteError } = useQuotePreview(ticker.toUpperCase(), isGeneric)

  // Auto-preencher o nome com o da cotação, a menos que o usuário tenha editado manualmente
  useEffect(() => {
    if (quote?.name && !nameEditedManually) {
      setName(quote.name)
    }
  }, [quote, nameEditedManually])

  // Inferir o tipo de ativo pelo padrão do ticker (FIIs terminam em 11).
  // Não sobrescreve se o usuário já escolheu cripto/moeda.
  useEffect(() => {
    if (GENERIC_CLASSES.has(assetClass)) return
    const t = ticker.trim().toUpperCase()
    if (/\d{2}$/.test(t) && t.endsWith('11')) {
      setAssetClass('fii')
    } else if (/34$/.test(t)) {
      setAssetClass('bdr')
    } else if (/[3-8]$/.test(t)) {
      setAssetClass('acao')
    }
  }, [ticker, assetClass])

  useEffect(() => {
    if (open) {
      setTicker(''); setName(''); setNameEditedManually(false); setAssetClass('acao')
      setQuantity(''); setPrice(''); setFees(''); setError('')
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const t = ticker.trim().toUpperCase()
    if (!t) { setError('Informe o ticker.'); return }
    if (!name.trim()) { setError('Informe o nome do ativo.'); return }

    const qty = quantity ? Number(quantity) : undefined
    const unitPrice = price ? brlToCents(price) : undefined
    if (quantity && (!qty || qty <= 0)) { setError('Quantidade inválida.'); return }
    if (price && !unitPrice) { setError('Preço inválido.'); return }

    try {
      await createMutation.mutateAsync({
        ticker: t,
        name: name.trim(),
        assetClass,
        quantity: qty,
        unitPrice: unitPrice ?? undefined,
        fees: fees ? (brlToCents(fees) ?? 0) : 0,
        date: qty && unitPrice ? date : undefined,
      })
      onClose()
    } catch {
      setError('Erro ao cadastrar o ativo.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nova renda variável</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder={isGeneric ? (assetClass === 'cripto' ? 'Ex: BTC-BRL, ETH-BRL' : 'Ex: USDBRL=X, EURBRL=X') : 'Ex: PETR4, HGLG11'}
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {isGeneric && (
              <p className="mt-1 text-[11px] text-gray-400">
                {assetClass === 'cripto' ? 'Use o par com BRL (ex: BTC-BRL).' : 'Use o par de câmbio (ex: USDBRL=X).'}
              </p>
            )}
            {loadingQuote && <p className="mt-1 text-xs text-gray-400">Buscando ativo...</p>}
            {quote && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-600 truncate">{quote.name ?? quote.ticker}</span>
                <span className="ml-auto font-bold text-emerald-700 flex-shrink-0">
                  {quote.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            {quoteError && ticker.trim().length >= 4 && !loadingQuote && (
              <p className="mt-1 text-xs text-amber-600">Ticker não encontrado. Confira o código ou preencha o nome manualmente.</p>
            )}
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium">
              Nome
              {name && !nameEditedManually && quote && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                  automático
                </span>
              )}
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameEditedManually(true) }}
              placeholder="Preenchido automaticamente ao digitar o ticker"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <p className="mt-1 text-[11px] text-gray-400">Só precisa do ticker — o nome é buscado automaticamente.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ASSET_CLASSES.map((ac) => (
                <button
                  key={ac.value}
                  type="button"
                  onClick={() => setAssetClass(ac.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    assetClass === ac.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {ac.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Operação inicial (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Quantidade</label>
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Preço unit. (R$)</label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Taxas (R$)</label>
                <input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal" placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
