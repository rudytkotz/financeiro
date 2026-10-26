import { useState, useEffect } from 'react'
import { useAllocationTargets, useSetTargets } from '@/hooks/useInvestments'
import { X, Target } from 'lucide-react'

const CLASSES = [
  { value: 'acao', label: 'Ações' },
  { value: 'fii', label: 'Fundos Imobiliários' },
  { value: 'etf', label: 'ETFs' },
  { value: 'bdr', label: 'BDRs' },
  { value: 'renda_fixa', label: 'Renda Fixa' },
] as const

export default function TargetsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: targets } = useAllocationTargets()
  const setMutation = useSetTargets()

  // Mapa classe → % (string pro input)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const c of CLASSES) {
        const t = (targets ?? []).find((x) => x.assetClass === c.value)
        initial[c.value] = t ? (t.targetPct / 100).toString() : ''
      }
      setValues(initial)
      setError('')
    }
  }, [open, targets])

  if (!open) return null

  const total = CLASSES.reduce((s, c) => s + (parseFloat(values[c.value]?.replace(',', '.') || '0') || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (total > 100) { setError('A soma das metas não pode ultrapassar 100%.'); return }

    const payload = CLASSES
      .map((c) => ({ assetClass: c.value, targetPct: Math.round((parseFloat(values[c.value]?.replace(',', '.') || '0') || 0) * 100) }))
      .filter((t) => t.targetPct > 0)

    try {
      await setMutation.mutateAsync(payload)
      onClose()
    } catch {
      setError('Erro ao salvar metas.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-blue-500" /> Metas de alocação
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-4 text-xs text-gray-400">
          Defina o percentual alvo de cada classe. A carteira vai comparar com a alocação real e sugerir aportes.
        </p>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {CLASSES.map((c) => (
            <div key={c.value} className="flex items-center gap-3">
              <label className="flex-1 text-sm font-medium text-gray-700">{c.label}</label>
              <div className="relative w-24">
                <input
                  value={values[c.value] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [c.value]: e.target.value }))}
                  inputMode="decimal" placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 pr-6 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
            </div>
          ))}

          <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
            total > 100 ? 'bg-red-50 text-red-600' : total === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-600'
          }`}>
            <span>Total</span>
            <span>{total.toFixed(0)}%{total < 100 && total > 0 && ` (${(100 - total).toFixed(0)}% livre)`}</span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={setMutation.isPending} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {setMutation.isPending ? 'Salvando...' : 'Salvar metas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
