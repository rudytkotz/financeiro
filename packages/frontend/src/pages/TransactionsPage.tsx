import { useMemo, useState, useCallback } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useDependents } from '@/hooks/useDependents'
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useDeleteAllTransactions,
} from '@/hooks/useMutations'
import TransactionModal from '@/components/TransactionModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import DependentSelector from '@/components/DependentSelector'
import type { Transaction } from '@financeiro/shared'
import {
  ArrowUpDown, ArrowUp, ArrowDown, Trash2,
  CreditCard, Smartphone, Wallet, Banknote,
  Search, SlidersHorizontal, Plus, X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: 'credito', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { value: 'pix', label: 'Pix', icon: Smartphone, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
  { value: 'debito', label: 'Débito', icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  { value: 'outros', label: 'Outros', icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' },
] as const

function getPaymentMethodInfo(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method) ?? PAYMENT_METHODS[4]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

type SortField = 'date' | 'description' | 'amount'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [categoryId, setCategoryId] = useState('')
  const [dependentId, setDependentId] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)

  // Data
  const filterParams = useMemo(() => {
    const p: Record<string, string> = { month }
    if (categoryId) p.categoryId = categoryId
    return p
  }, [month, categoryId])

  const { data: transactionsData, isLoading } = useTransactions(filterParams)
  const rawTransactions = transactionsData?.transactions ?? []
  const { data: categories } = useCategories()
  const { data: dependents } = useDependents()

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const deleteMutation = useDeleteTransaction()
  const deleteAllMutation = useDeleteAllTransactions()

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    if (categories) for (const c of categories) map.set(c.id, c.name)
    return map
  }, [categories])

  // Filter + sort
  const transactions = useMemo(() => {
    let list = rawTransactions
    if (dependentId) list = list.filter((t) => t.dependentId === dependentId)
    if (paymentMethodFilter) list = list.filter((t) => (t as any).paymentMethod === paymentMethodFilter)
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter((t) => t.description.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortField === 'description') cmp = a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
      else cmp = a.amount - b.amount
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rawTransactions, dependentId, paymentMethodFilter, searchText, sortField, sortDir])

  const total = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions])
  const activeFilterCount = [categoryId, dependentId, paymentMethodFilter, searchText].filter(Boolean).length

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return field }
      setSortDir(field === 'amount' ? 'desc' : 'asc'); return field
    })
  }, [])

  const clearFilters = () => { setCategoryId(''); setDependentId(''); setPaymentMethodFilter(''); setSearchText('') }

  function handleOpenCreate() { setEditingTransaction(null); setModalOpen(true) }
  function handleCloseModal() { setModalOpen(false); setEditingTransaction(null) }
  async function handleSubmit(data: { date: string; description: string; amount: number; categoryId: string }) {
    if (editingTransaction) await updateMutation.mutateAsync({ id: editingTransaction.id, payload: data })
    else await createMutation.mutateAsync(data)
  }
  function handleOpenDelete(t: Transaction) { setTransactionToDelete(t); setDeleteDialogOpen(true) }
  async function handleConfirmDelete() { if (!transactionToDelete) return; await deleteMutation.mutateAsync(transactionToDelete.id); setDeleteDialogOpen(false); setTransactionToDelete(null) }
  async function handleConfirmDeleteAll() { await deleteAllMutation.mutateAsync(month); setDeleteAllDialogOpen(false) }

  const handleDescriptionSave = useCallback(async (id: string, val: string, orig: string) => {
    const v = val.trim(); if (!v || v === orig) return
    await updateMutation.mutateAsync({ id, payload: { description: v } })
  }, [updateMutation])

  const handleCategorySave = useCallback(async (id: string, val: string, orig: string) => {
    if (val === orig) return
    await updateMutation.mutateAsync({ id, payload: { categoryId: val } })
  }, [updateMutation])

  const handlePaymentMethodSave = useCallback(async (id: string, val: string) => {
    await updateMutation.mutateAsync({ id, payload: { paymentMethod: val } as any })
  }, [updateMutation])

  // Sort icon component
  function SortBtn({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    return (
      <button onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 text-left font-medium select-none ${active ? 'text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
        {children}
        {!active && <ArrowUpDown className="h-3 w-3 opacity-40" />}
        {active && sortDir === 'asc' && <ArrowUp className="h-3 w-3" />}
        {active && sortDir === 'desc' && <ArrowDown className="h-3 w-3" />}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Transações</h1>
        <button onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 md:px-4 md:text-sm">
          <Plus className="h-4 w-4" /> Nova
        </button>
      </div>

      {/* ===== MONTH + SEARCH BAR ===== */}
      <div className="flex items-center gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar transação..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`relative inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition ${showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ===== FILTERS PANEL ===== */}
      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Limpar todos</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500 uppercase">Tipo</label>
              <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todos</option>
                {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500 uppercase">Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todas</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500 uppercase">Dependente</label>
              <select value={dependentId} onChange={(e) => setDependentId(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todos</option>
                {(dependents ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              {rawTransactions.length > 0 && (
                <button onClick={() => setDeleteAllDialogOpen(true)}
                  className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                  Excluir todas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CONTENT ===== */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-3">
            <CreditCard className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">Nenhuma transação encontrada</p>
          <p className="text-xs text-gray-400 mt-1">Tente alterar os filtros ou importar uma fatura</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-4 py-2.5">
            <span className="text-xs text-gray-500">{transactions.length} transação(ões)</span>
            <span className={`text-sm font-bold ${total < 0 ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(total)}</span>
          </div>

          {/* === DESKTOP TABLE === */}
          <div className="hidden md:block rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left"><SortBtn field="date">Data</SortBtn></th>
                  <th className="px-4 py-3 text-left"><SortBtn field="description">Descrição</SortBtn></th>
                  <th className="px-4 py-3 text-right"><SortBtn field="amount">Valor</SortBtn></th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Parcela</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Dependente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Tipo</th>
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((t) => (
                  <DesktopRow key={t.id} t={t} categories={categories ?? []} dependents={dependents ?? []}
                    onDescSave={handleDescriptionSave} onCatSave={handleCategorySave}
                    onPmSave={handlePaymentMethodSave} onDelete={handleOpenDelete} />
                ))}
              </tbody>
            </table>
          </div>

          {/* === MOBILE CARDS === */}
          <div className="space-y-2 md:hidden">
            {transactions.map((t) => (
              <MobileCard key={t.id} t={t} categoryMap={categoryMap} categories={categories ?? []} dependents={dependents ?? []}
                onDescSave={handleDescriptionSave} onCatSave={handleCategorySave}
                onPmSave={handlePaymentMethodSave} onDelete={handleOpenDelete} />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <TransactionModal open={modalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} categories={categories ?? []} transaction={editingTransaction} />
      <ConfirmDialog open={deleteDialogOpen} title="Excluir transação" message="Tem certeza? Esta ação não pode ser desfeita." confirmLabel="Excluir" cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete} onCancel={() => { setDeleteDialogOpen(false); setTransactionToDelete(null) }} isLoading={deleteMutation.isPending} />
      <ConfirmDialog open={deleteAllDialogOpen} title="Excluir todas" message={`Excluir todas as transações de ${month}? Não pode ser desfeito.`} confirmLabel="Excluir todas" cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteAll} onCancel={() => setDeleteAllDialogOpen(false)} isLoading={deleteAllMutation.isPending} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop Table Row
// ---------------------------------------------------------------------------

interface RowProps {
  t: Transaction
  categories: Array<{ id: string; name: string }>
  dependents: Array<{ id: string; name: string }>
  onDescSave: (id: string, v: string, orig: string) => void
  onCatSave: (id: string, v: string, orig: string) => void
  onPmSave: (id: string, v: string) => void
  onDelete: (t: Transaction) => void
}

function DesktopRow({ t, categories, dependents, onDescSave, onCatSave, onPmSave, onDelete }: RowProps) {
  const [desc, setDesc] = useState(t.description)
  const pmInfo = getPaymentMethodInfo((t as any).paymentMethod || 'credito')

  return (
    <tr className="group hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(t.date)}</td>
      <td className="px-4 py-2.5">
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onDescSave(t.id, desc, t.description)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm transition hover:border-gray-200 hover:bg-white focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </td>
      <td className={`px-4 py-2.5 text-right text-sm font-medium whitespace-nowrap ${t.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
        {formatCurrency(t.amount)}
      </td>
      <td className="px-4 py-2.5 text-center">
        {t.installmentCurrent && t.installmentTotal ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {t.installmentCurrent}/{t.installmentTotal}
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2.5">
        <select value={t.categoryId} onChange={(e) => onCatSave(t.id, e.target.value, t.categoryId)}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs transition hover:border-gray-200 hover:bg-white focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={dependents} />
      </td>
      <td className="px-4 py-2.5 text-center">
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPmSave(t.id, e.target.value)}
          className={`rounded-full ${pmInfo.bg} ${pmInfo.border} border px-2 py-0.5 text-[10px] font-medium ${pmInfo.color} focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer`}>
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-2.5">
        <button onClick={() => onDelete(t)}
          className="rounded-md p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Mobile Card
// ---------------------------------------------------------------------------

interface MobileCardProps extends RowProps {
  categoryMap: Map<string, string>
}

function MobileCard({ t, categoryMap, categories, dependents, onDescSave, onCatSave, onPmSave, onDelete }: MobileCardProps) {
  const [desc, setDesc] = useState(t.description)
  const pmInfo = getPaymentMethodInfo((t as any).paymentMethod || 'credito')
  const PmIcon = pmInfo.icon

  return (
    <div className={`rounded-xl border ${pmInfo.border} bg-white p-3 shadow-sm transition hover:shadow-md`}>
      {/* Header: type icon + date + installment ... amount + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-md ${pmInfo.bg} p-1.5`}>
            <PmIcon className={`h-3.5 w-3.5 ${pmInfo.color}`} />
          </div>
          <span className="text-xs text-gray-400">{formatDate(t.date)}</span>
          {t.installmentCurrent && t.installmentTotal && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              {t.installmentCurrent}/{t.installmentTotal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${t.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {formatCurrency(t.amount)}
          </span>
          <button onClick={() => onDelete(t)} className="rounded-md p-1 text-gray-300 hover:text-red-500 hover:bg-red-50">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Description */}
      <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
        onBlur={() => onDescSave(t.id, desc, t.description)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="mt-2 w-full rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />

      {/* Bottom row: category, type, dependent */}
      <div className="mt-2 flex items-center gap-1.5">
        <select value={t.categoryId} onChange={(e) => onCatSave(t.id, e.target.value, t.categoryId)}
          className="flex-1 min-w-0 rounded-md border border-gray-100 bg-gray-50 px-1.5 py-1 text-[11px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPmSave(t.id, e.target.value)}
          className={`rounded-md border ${pmInfo.border} ${pmInfo.bg} px-1.5 py-1 text-[11px] font-medium ${pmInfo.color} focus:outline-none focus:ring-1 focus:ring-primary`}>
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
        <div className="flex-1 min-w-0">
          <DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={dependents} />
        </div>
      </div>
    </div>
  )
}
