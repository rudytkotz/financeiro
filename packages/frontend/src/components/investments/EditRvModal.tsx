import { useState, useEffect } from 'react'
import { useUpdateRvInvestment } from '@/hooks/useInvestments'
import type { RvAssetClass, Investment } from '@financeiro/shared'
import { X } from 'lucide-react'

const ASSET_CLASSES: Array<{ value: RvAssetClass; label: string }> = [
  { value: 'acao', label: 'Ação' },
  { value: 'fii', label: 'FII' },
  { value: 'etf', label: 'ETF' },
  { value: 'bdr', label: 'BDR' },
]

export default function EditRvModal({ investment, onClose }: { investment: Investment | null; onClose: () => void }) {
  const updateMutation = useUpdateRvInvestment()
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [assetClass, setAssetClass] = useState<RvAssetClass>('acao')
  const [error, setError] = useState('')

  useEffect(() => {
    if (investment) {
      setTicker(investment.ticker ?? '')
      setName(investment.name)
      setAssetClass((investment.assetClass as RvAssetClass) ?? 'acao')
      setError('')
    }
  }, [investment])

  if (!investment) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!ticker.trim()) { setError('Informe o ticker.'); return }
    if (!name.trim()) { setError('Informe o nome.'); return }
    try {
      await updateMutation.mutateAsync({
        id: investment!.id,
        payload: { ticker: ticker.trim().toUpperCase(), name: name.trim(), assetClass },
      })
      onClose()
    } catch {
      setError('Erro ao atualizar o ativo.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Editar ativo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Ticker</label>
            <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ASSET_CLASSES.map((ac) => (
                <button key={ac.value} type="button" onClick={() => setAssetClass(ac.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    assetClass === ac.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {ac.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={updateMutation.isPending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
