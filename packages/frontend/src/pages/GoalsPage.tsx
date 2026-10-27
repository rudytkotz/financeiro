import { useState } from 'react'
import { useGoals, useCreateGoal, useDeleteGoal, useAddContribution } from '@/hooks/useGoals'
import type { Goal } from '@financeiro/shared'
import { Target, Plus, Trash2, PiggyBank, Check } from 'lucide-react'

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals()
  const createGoal = useCreateGoal()
  const deleteGoal = useDeleteGoal()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')

  function handleCreate() {
    const cents = parseCurrency(targetAmount)
    if (!name.trim()) { setError('Informe o nome da meta.'); return }
    if (cents <= 0) { setError('Informe o valor alvo.'); return }
    createGoal.mutate(
      { name: name.trim(), targetAmount: cents, targetDate: targetDate || null },
      {
        onSuccess: () => { setName(''); setTargetAmount(''); setTargetDate(''); setShowForm(false); setError('') },
        onError: () => setError('Erro ao criar a meta.'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas</h1>
          <p className="text-sm text-gray-500">Objetivos e reserva de emergência</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-95">
          <Plus className="h-4 w-4" /> Nova meta
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva, Viagem..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">R$</span>
              <input type="text" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="Valor alvo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="Prazo (opcional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setError('') }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} disabled={createGoal.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {createGoal.isPending ? 'Salvando...' : 'Criar meta'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (goals ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-gray-100 p-5 mb-4"><Target className="h-10 w-10 text-gray-300" /></div>
          <p className="text-sm font-semibold text-gray-500">Nenhuma meta ainda</p>
          <p className="text-xs text-gray-400 mt-1">Crie uma meta para começar a juntar dinheiro com objetivo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(goals ?? []).map((goal) => (
            <GoalCard key={goal.id} goal={goal} onDelete={() => deleteGoal.mutate(goal.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const addContribution = useAddContribution()
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const pct = Math.min(goal.percentage, 100)
  const complete = goal.currentAmount >= goal.targetAmount
  const accent = goal.color ?? '#3b82f6'

  function save() {
    const cents = parseCurrency(value)
    if (cents <= 0) { setAdding(false); return }
    addContribution.mutate(
      { goalId: goal.id, payload: { amount: cents, date: today() } },
      { onSuccess: () => { setValue(''); setAdding(false) } },
    )
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-2" style={{ backgroundColor: `${accent}22` }}>
            <PiggyBank className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{goal.name}</p>
            {goal.targetDate && <p className="text-[11px] text-gray-400">Prazo: {goal.targetDate.split('-').reverse().join('/')}</p>}
          </div>
        </div>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-gray-900">{formatCurrency(goal.currentAmount)}</span>
          <span className="text-gray-400">de {formatCurrency(goal.targetAmount)}</span>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-gray-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: complete ? '#10b981' : accent }} />
        </div>
        <p className={`mt-1 text-[11px] ${complete ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
          {complete ? '🎉 Meta atingida!' : `${goal.percentage.toFixed(0)}% · faltam ${formatCurrency(goal.remaining)}`}
        </p>
      </div>

      <div className="mt-4">
        {adding ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">R$</span>
            <input autoFocus value={value} inputMode="decimal" onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Valor do aporte"
              className="flex-1 rounded-lg border border-primary/40 px-3 py-1.5 text-sm focus:outline-none" />
            <button onClick={save} disabled={addContribution.isPending} className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Check className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-primary/40 hover:text-primary transition">
            + Registrar aporte
          </button>
        )}
      </div>
    </div>
  )
}
