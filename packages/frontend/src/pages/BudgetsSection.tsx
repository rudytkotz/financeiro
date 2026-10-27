import { useState } from 'react'
import { useBudgets, useSetBudget } from '@/hooks/useBudgets'
import type { BudgetRow } from '@financeiro/shared'
import { ChevronLeft, ChevronRight, Target, Check, Pencil } from 'lucide-react'

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonth(ym: string, offset: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [y, m] = month.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]} ${y}`
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100)
}

export default function BudgetsSection() {
  const [month, setMonth] = useState(getCurrentMonth)
  const { data, isLoading } = useBudgets(month)

  const rows = data?.rows ?? []
  const defined = rows.filter((r) => r.amount > 0)
  const totalBudget = data?.totalBudget ?? 0
  const totalSpent = data?.totalSpent ?? 0
  const totalPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0

  return (
    <div className="space-y-5">
      {/* Navegação de mês */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setMonth(offsetMonth(month, -1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4 text-gray-600" /></button>
        <span className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">{monthLabel(month)}</span>
        <button onClick={() => setMonth(offsetMonth(month, 1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4 text-gray-600" /></button>
      </div>

      {/* Resumo total */}
      {totalBudget > 0 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Orçamento total</span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-gray-100">
            <div className={`h-full rounded-full transition-all ${totalSpent > totalBudget ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${totalPct}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Defina um teto mensal por categoria. {defined.length === 0 && 'Clique no lápis para começar.'}
          </p>
          <div className="space-y-2">
            {rows.map((row) => (
              <BudgetItem key={row.categoryId} row={row} month={month} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BudgetItem({ row, month }: { row: BudgetRow; month: string }) {
  const setBudget = useSetBudget()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(() => (row.amount / 100).toFixed(2).replace('.', ','))

  const pct = Math.min(row.percentage, 100)
  const over = row.amount > 0 && row.spent > row.amount
  const near = row.amount > 0 && !over && row.percentage >= 80

  function save() {
    const cents = parseCurrency(value)
    if (cents !== row.amount) {
      setBudget.mutate({ categoryId: row.categoryId, month, amount: cents })
    }
    setEditing(false)
  }

  const barColor = over ? 'bg-red-500' : near ? 'bg-amber-400' : 'bg-primary'
  const dot = row.categoryColor ?? '#9ca3af'

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: dot }} />
          <span className="text-sm font-medium text-gray-800">{row.categoryName}</span>
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">R$</span>
            <input
              autoFocus value={value} inputMode="decimal"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              className="w-24 rounded border border-primary/40 px-2 py-1 text-right text-sm focus:outline-none"
            />
            <button onClick={save} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Salvar"><Check className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm">
            {row.amount > 0 ? (
              <span className="font-semibold text-gray-700">{formatCurrency(row.spent)} / {formatCurrency(row.amount)}</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400"><Target className="h-3.5 w-3.5" /> Definir teto</span>
            )}
            <Pencil className="h-3 w-3 text-gray-300" />
          </button>
        )}
      </div>
      {row.amount > 0 && (
        <>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className={`mt-1 text-[11px] ${over ? 'text-red-600' : near ? 'text-amber-600' : 'text-gray-400'}`}>
            {over
              ? `Estourou em ${formatCurrency(row.spent - row.amount)}`
              : `Restam ${formatCurrency(row.remaining)} (${row.percentage.toFixed(0)}% usado)`}
          </p>
        </>
      )}
    </div>
  )
}
