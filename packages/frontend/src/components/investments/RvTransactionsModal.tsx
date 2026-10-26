import { useState, useEffect } from 'react'
import { useAddInvestmentTransaction, useDeleteInvestmentTransaction, useUpdateInvestmentTransaction } from '@/hooks/useInvestments'
import type { RvPosition, InvestmentTransaction } from '@financeiro/shared'
import { X, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Pencil, Check } from 'lucide-react'

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brlToCents(value: string): number | null {
  const n = Number(value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

export default function RvTransactionsModal({ position, onClose }: { position: RvPosition | null; onClose: () => void }) {
  const addMutation = useAddInvestmentTransaction()
  const deleteMutation = useDeleteInvestmentTransaction()

  const [operation, setOperation] = useState<'compra' | 'venda'>('compra')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  useEffect(() => {
    if (position) {
      setOperation('compra'); setQuantity(''); setPrice(''); setFees(''); setError('')
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [position])

  if (!position) return null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const qty = Number(quantity)
    const unitPrice = brlToCents(price)
    if (!qty || qty <= 0) { setError('Quantidade inválida.'); return }
    if (!unitPrice) { setError('Preço inválido.'); return }

    try {
      await addMutation.mutateAsync({
        investmentId: position!.investment.id,
        payload: { operation, quantity: qty, unitPrice, fees: fees ? (brlToCents(fees) ?? 0) : 0, date },
      })
      setQuantity(''); setPrice(''); setFees('')
    } catch {
      setError('Erro ao registrar operação.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{position.investment.ticker}</h2>
            <p className="text-xs text-gray-400">{position.investment.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Resumo da posição */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Quantidade</p>
            <p className="text-sm font-bold text-gray-800">{position.quantity}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Preço médio</p>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(position.averagePrice)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Investido</p>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(position.investedTotal)}</p>
          </div>
        </div>

        {/* Form nova operação */}
        <form onSubmit={handleAdd} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOperation('compra')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                operation === 'compra' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
              }`}>
              <ArrowDownCircle className="h-4 w-4" /> Compra
            </button>
            <button type="button" onClick={() => setOperation('venda')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                operation === 'venda' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
              }`}>
              <ArrowUpCircle className="h-4 w-4" /> Venda
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" placeholder="Qtd"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Preço R$"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal" placeholder="Taxas R$"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={addMutation.isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {addMutation.isPending ? 'Registrando...' : 'Registrar operação'}
          </button>
        </form>

        {/* Lista de operações */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Histórico de operações</p>
          {position.transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma operação registrada.</p>
          ) : (
            <ul className="divide-y divide-gray-50 rounded-xl border border-gray-100">
              {position.transactions.map((tx) => (
                <TxRow key={tx.id} tx={tx} onDelete={() => { if (confirm('Excluir esta operação?')) deleteMutation.mutate(tx.id) }} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linha de operação com edição inline
// ---------------------------------------------------------------------------
function TxRow({ tx, onDelete }: { tx: InvestmentTransaction; onDelete: () => void }) {
  const updateMutation = useUpdateInvestmentTransaction()
  const [editing, setEditing] = useState(false)
  const [operation, setOperation] = useState<'compra' | 'venda'>(tx.operation)
  const [quantity, setQuantity] = useState(String(tx.quantity))
  const [price, setPrice] = useState((tx.unitPrice / 100).toFixed(2).replace('.', ','))
  const [date, setDate] = useState(tx.date)
  const [saving, setSaving] = useState(false)

  function cancel() {
    setOperation(tx.operation)
    setQuantity(String(tx.quantity))
    setPrice((tx.unitPrice / 100).toFixed(2).replace('.', ','))
    setDate(tx.date)
    setEditing(false)
  }

  async function save() {
    const qty = Number(quantity)
    const unitPrice = brlToCents(price)
    if (!qty || qty <= 0 || !unitPrice) return
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ txId: tx.id, payload: { operation, quantity: qty, unitPrice, date } })
      setEditing(false)
    } catch {
      // mantém em edição
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <li className="px-3 py-2.5 text-sm space-y-2 bg-gray-50/50">
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setOperation('compra')}
            className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold ${operation === 'compra' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>Compra</button>
          <button type="button" onClick={() => setOperation('venda')}
            className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold ${operation === 'venda' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>Venda</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" placeholder="Qtd"
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Preço"
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
        </div>
        <div className="flex justify-end gap-1.5">
          <button onClick={cancel} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            <Check className="h-3 w-3" /> Salvar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between px-3 py-2.5 text-sm group">
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${tx.operation === 'compra' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {tx.operation}
        </span>
        <span className="text-gray-600">{tx.quantity} × {formatCurrency(tx.unitPrice)}</span>
        <span className="text-[11px] text-gray-400">{tx.date.split('-').reverse().join('/')}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500 transition">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}
