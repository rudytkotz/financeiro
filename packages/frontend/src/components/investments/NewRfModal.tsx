import { useState, useEffect } from 'react'
import { useCreateRfInvestment } from '@/hooks/useInvestments'
import type { RfAssetClass, RateType } from '@financeiro/shared'
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

export default function NewRfModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateRfInvestment()
  const [name, setName] = useState('')
  const [assetClass, setAssetClass] = useState<RfAssetClass>('cdb')
  const [amount, setAmount] = useState('')
  const [applicationDate, setApplicationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [maturityDate, setMaturityDate] = useState('')
  const [rateType, setRateType] = useState<RateType>('pos_cdi')
  const [rateValue, setRateValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(''); setAssetClass('cdb'); setAmount(''); setMaturityDate(''); setRateType('pos_cdi'); setRateValue(''); setError('')
      setApplicationDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe o nome.'); return }
    const cents = brlToCents(amount)
    if (!cents) { setError('Valor aplicado inválido.'); return }
    const rate = Number(rateValue.replace(',', '.'))
    if (isNaN(rate) || rate <= 0) { setError('Taxa inválida.'); return }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        assetClass,
        investedAmount: cents,
        applicationDate,
        maturityDate: maturityDate || null,
        rateType,
        rateValue: Math.round(rate * 100), // % → % * 100
      })
      onClose()
    } catch {
      setError('Erro ao cadastrar.')
    }
  }

  const currentRateHint = RATE_TYPES.find((r) => r.value === rateType)?.hint

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nova renda fixa</h2>
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

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
