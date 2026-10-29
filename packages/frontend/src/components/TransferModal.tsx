import { useEffect, useState } from 'react'
import type { Account } from '@financeiro/shared'
import { useCreateTransfer } from '@/hooks/useAccounts'
import AccountSelect from '@/components/AccountSelect'
import { X, ArrowRight } from 'lucide-react'

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100)
}

export default function TransferModal({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: Account[] }) {
  const createTransfer = useCreateTransfer()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setFromId(''); setToId(''); setAmount(''); setDescription(''); setError('')
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  if (!open) return null

  function handleSave() {
    const cents = parseCurrency(amount)
    if (!fromId || !toId) { setError('Escolha a conta de origem e a de destino.'); return }
    if (fromId === toId) { setError('Origem e destino devem ser diferentes.'); return }
    if (cents <= 0) { setError('Informe um valor válido.'); return }

    createTransfer.mutate(
      { fromAccountId: fromId, toAccountId: toId, amount: cents, date, description: description.trim() || undefined },
      { onSuccess: onClose, onError: () => setError('Erro ao transferir. Verifique os dados.') },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Transferência entre contas</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">De</label>
              <AccountSelect accounts={accounts} value={fromId} onChange={setFromId} emptyLabel="Origem" />
            </div>
            <ArrowRight className="mb-2.5 h-4 w-4 flex-shrink-0 text-gray-300" />
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Para</label>
              <AccountSelect accounts={accounts} value={toId} onChange={setToId} emptyLabel="Destino" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Valor</label>
              <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 focus-within:ring-2 focus-within:ring-primary/30">
                <span className="text-sm text-gray-400">R$</span>
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
                  className="w-full bg-transparent px-1 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Descrição <span className="font-normal normal-case text-gray-300">(opcional)</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Guardar para a reserva"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={createTransfer.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createTransfer.isPending ? 'Transferindo...' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  )
}
