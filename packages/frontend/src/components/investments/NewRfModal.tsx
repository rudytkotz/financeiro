import { useState, useEffect } from 'react'
import { useCreateRfInvestment, useUpdateRfInvestment } from '@/hooks/useInvestments'
import { useAccounts } from '@/hooks/useAccounts'
import AccountSelect from '@/components/AccountSelect'
import type { RfAssetClass, RateType, Investment } from '@financeiro/shared'
import { X } from 'lucide-react'

const ASSET_CLASSES: Array<{ value: RfAssetClass; label: string }> = [
  { value: 'cdb', label: 'CDB' },
  { value: 'tesouro', label: 'Tesouro' },
  { value: 'lci', label: 'LCI' },
  { value: 'lca', label: 'LCA' },
  { value: 'debenture', label: 'Debênture' },
  { value: 'outro', label: 'Outro' },
]

const RATE_TYPES: Array<{ value: RateType; label: string; hint: string }> = [
  { value: 'pos_cdi', label: '% do CDI', hint: 'Ex: 110 (= 110% do CDI)' },
  { value: 'prefixado', label: 'Prefixado', hint: 'Ex: 12 (= 12% a.a.)' },
  { value: 'ipca_mais', label: 'IPCA+', hint: 'Ex: 6 (= IPCA + 6% a.a.)' },
]

function brlToCents(value: string): number | null {
  const n = Number(value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

export default function NewRfModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Investment | null }) {
  const createMutation = useCreateRfInvestment()
  const updateMutation = useUpdateRfInvestment()
  const { data: accounts } = useAccounts()
  const isEdit = !!editing
  const [name, setName] = useState('')
  const [assetClass, setAssetClass] = useState<RfAssetClass>('cdb')
  const [amount, setAmount] = useState('')
  const [applicationDate, setApplicationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [maturityDate, setMaturityDate] = useState('')
  const [rateType, setRateType] = useState<RateType>('pos_cdi')
  const [rateValue, setRateValue] = useState('')
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name)
        setAssetClass((editing.assetClass as RfAssetClass) ?? 'cdb')
        setAmount(((editing.investedAmount ?? 0) / 100).toFixed(2).replace('.', ','))
        setApplicationDate(editing.applicationDate ?? new Date().toISOString().slice(0, 10))
        setMaturityDate(editing.maturityDate ?? '')
        setRateType((editing.rateType as RateType) ?? 'pos_cdi')
        setRateValue(editing.rateValue !== null ? (editing.rateValue / 100).toString() : '')
        setAccountId(editing.accountId ?? '')
      } else {
        setName(''); setAssetClass('cdb'); setAmount(''); setMaturityDate(''); setRateType('pos_cdi'); setRateValue(''); setAccountId('')
        setApplicationDate(new Date().toISOString().slice(0, 10))
      }
      setError('')
    }
  }, [open, editing])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe o nome.'); return }
    const cents = brlToCents(amount)
    if (!cents) { setError('Valor aplicado inválido.'); return }
    const rate = Number(rateValue.replace(',', '.'))
    if (isNaN(rate) || rate <= 0) { setError('Taxa inválida.'); return }

    const payload = {
      name: name.trim(),
      assetClass,
      investedAmount: cents,
      applicationDate,
      maturityDate: maturityDate || null,
      rateType,
      rateValue: Math.round(rate * 100), // % → % * 100
      accountId: accountId || null,
    }

    try {
      if (isEdit && editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch {
      setError(isEdit ? 'Erro ao atualizar.' : 'Erro ao cadastrar.')
    }
  }

  const currentRateHint = RATE_TYPES.find((r) => r.value === rateType)?.hint

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar renda fixa' : 'Nova renda fixa'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: CDB Banco XP"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ASSET_CLASSES.map((ac) => (
                <button key={ac.value} type="button" onClick={() => setAssetClass(ac.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    assetClass === ac.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {ac.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Valor aplicado (R$)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Rentabilidade</label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {RATE_TYPES.map((rt) => (
                <button key={rt.value} type="button" onClick={() => setRateType(rt.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    rateType === rt.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {rt.label}
                </button>
              ))}
            </div>
            <input value={rateValue} onChange={(e) => setRateValue(e.target.value)} inputMode="decimal" placeholder={currentRateHint}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <p className="mt-1 text-[11px] text-gray-400">{currentRateHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Aplicação</label>
              <input type="date" value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vencimento</label>
              <input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>

          {(accounts ?? []).length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Conta / corretora <span className="text-[10px] font-normal text-gray-400">(opcional)</span></label>
              <AccountSelect
                accounts={accounts ?? []}
                value={accountId}
                onChange={setAccountId}
                emptyLabel="Não vincular"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
