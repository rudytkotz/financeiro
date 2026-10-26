import { useState, useEffect } from 'react'
import { useInvestments, useAddDividend } from '@/hooks/useInvestments'
import { X, Coins } from 'lucide-react'

function brlToCents(value: string): number | null {
  const n = Number(value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

const KINDS = [
  { value: 'dividendo', label: 'Dividendo' },
  { value: 'jcp', label: 'JCP' },
  { value: 'rendimento', label: 'Rendimento (FII)' },
] as const

export default function DividendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: allInvestments } = useInvestments()
  const addMutation = useAddDividend()

  const [investmentId, setInvestmentId] = useState('')
  const [kind, setKind] = useState<'dividendo' | 'jcp' | 'rendimento'>('dividendo')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const rvInvestments = (allInvestments ?? []).filter((i) => i.type === 'renda_variavel')

  useEffect(() => {
    if (open) {
      setInvestmentId(''); setKind('dividendo'); setAmount(''); setError('')
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!investmentId) { setError('Selecione o ativo.'); return }
    const cents = brlToCents(amount)
    if (!cents) { setError('Valor inválido.'); return }

    try {
      await addMutation.mutateAsync({ investmentId, kind, amount: cents, date })
      onClose()
    } catch {
      setError('Erro ao registrar provento.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-amber-500" /> Registrar provento
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {rvInvestments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Cadastre um ativo de renda variável primeiro.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Ativo</label>
              <select value={investmentId} onChange={(e) => setInvestmentId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">Selecione...</option>
                {rvInvestments.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.ticker} — {inv.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {KINDS.map((k) => (
                  <button key={k.value} type="button" onClick={() => setKind(k.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      kind === k.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Valor total (R$)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={addMutation.isPending} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {addMutation.isPending ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
