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
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, CreditCard, Smartphone, Wallet, Banknote } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'credito', label: 'Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { value: 'pix', label: 'Pix', icon: Smartphone, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { value: 'debito', label: 'Débito', icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { value: 'outros', label: 'Outros', icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
] as const

function getPaymentMethodInfo(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method) ?? PAYMENT_METHODS[4]
}

function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}`
}

type SortField = 'date' | 'description' | 'amount' | 'category'
type SortDir = 'asc' | 'desc'

export default function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [categoryId, setCategoryId] = useState<string>('')
  const [dependentId, setDependentId] = useState<string>('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)

  const filterParams = useMemo(() => {
    const params: Record<string, string> = { month }
    if (categoryId) params.categoryId = categoryId
    return params
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
    if (categories) for (const cat of categories) map.set(cat.id, cat.name)
    return map
  }, [categories])

  const transactions = useMemo(() => {
    let filtered = rawTransactions
    if (dependentId) filtered = filtered.filter((t) => t.dependentId === dependentId)
    if (paymentMethodFilter) filtered = filtered.filter((t) => (t as any).paymentMethod === paymentMethodFilter)
    if (searchText.trim()) {
      const lower = searchText.toLowerCase()
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(lower))
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'description': cmp = a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' }); break
        case 'amount': cmp = a.amount - b.amount; break
        case 'category': cmp = (categoryMap.get(a.categoryId) ?? '').localeCompare(categoryMap.get(b.categoryId) ?? '', 'pt-BR'); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rawTransactions, dependentId, paymentMethodFilter, searchText, sortField, sortDir, categoryMap])

  const total = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => { if (prev === field) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return field } setSortDir('asc'); return field })
  }, [])

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-400" />
    return sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
  }

  function handleOpenCreate() { setEditingTransaction(null); setModalOpen(true) }
  function handleCloseModal() { setModalOpen(false); setEditingTransaction(null) }
  async function handleSubmit(data: { date: string; description: string; amount: number; categoryId: string }) {
    if (editingTransaction) await updateMutation.mutateAsync({ id: editingTransaction.id, payload: data })
    else await createMutation.mutateAsync(data)
  }
  function handleOpenDelete(t: Transaction) { setTransactionToDelete(t); setDeleteDialogOpen(true) }
  function handleCancelDelete() { setDeleteDialogOpen(false); setTransactionToDelete(null) }
  async function handleConfirmDelete() { if (!transactionToDelete) return; await deleteMutation.mutateAsync(transactionToDelete.id); setDeleteDialogOpen(false); setTransactionToDelete(null) }
  function handleOpenDeleteAll() { setDeleteAllDialogOpen(true) }
  function handleCancelDeleteAll() { setDeleteAllDialogOpen(false) }
  async function handleConfirmDeleteAll() { await deleteAllMutation.mutateAsync(month); setDeleteAllDialogOpen(false) }

  const handleDescriptionBlur = useCallback(async (id: string, newValue: string, original: string) => {
    const trimmed = newValue.trim(); if (!trimmed || trimmed === original) return
    await updateMutation.mutateAsync({ id, payload: { description: trimmed } })
  }, [updateMutation])

  const handleCategoryChange = useCallback(async (id: string, newCatId: string, original: string) => {
    if (newCatId === original) return
    await updateMutation.mutateAsync({ id, payload: { categoryId: newCatId } })
  }, [updateMutation])

  const handlePaymentMethodChange = useCallback(async (id: string, newMethod: string) => {
    await updateMutation.mutateAsync({ id, payload: { paymentMethod: newMethod } as any })
  }, [updateMutation])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold md:text-2xl">Transações</h1>
        <div className="flex items-center gap-2">
          {rawTransactions.length > 0 && (
            <button onClick={handleOpenDeleteAll} className="hidden sm:inline-flex rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
              Excluir todas
            </button>
          )}
          <button onClick={handleOpenCreate} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 md:px-4 md:py-2 md:text-sm">
            + Nova
          </button>
        </div>
      </div>

      {/* Month + quick filter toggle */}
      <div className="mt-3 flex items-center gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary md:flex-none md:w-auto" />
        <button onClick={() => setShowFilters(!showFilters)}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 md:hidden">
          Filtros {showFilters ? '▲' : '▼'}
        </button>
      </div>

      {/* Filters - always visible on desktop, toggleable on mobile */}
      <div className={`mt-3 flex flex-wrap items-end gap-2 ${showFilters ? '' : 'hidden md:flex'}`}>
        <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Tipo: Todos</option>
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Categoria: Todas</option>
          {(categories ?? []).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <select value={dependentId} onChange={(e) => setDependentId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Dependente: Todos</option>
          {(dependents ?? []).map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
        </select>
        <input type="text" placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[120px]" />
        {rawTransactions.length > 0 && (
          <button onClick={handleOpenDeleteAll} className="sm:hidden rounded border border-red-300 bg-white px-2 py-1.5 text-xs font-medium text-red-600">
            Excluir todas
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
      ) : (
        <>
          <div className="mt-3 text-xs text-gray-500">
            {transactions.length} item(ns) • Total: <span className="font-semibold">{formatCurrency(total)}</span>
          </div>

          {/* Desktop table */}
          <div className="mt-2 hidden md:block overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('date')}>Data <SortIcon field="date" /></th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('description')}>Descrição <SortIcon field="description" /></th>
                  <th className="px-3 py-2 text-right font-medium cursor-pointer select-none" onClick={() => handleSort('amount')}>Valor <SortIcon field="amount" /></th>
                  <th className="px-3 py-2 text-center font-medium">Parcela</th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer select-none" onClick={() => handleSort('category')}>Categoria <SortIcon field="category" /></th>
                  <th className="px-3 py-2 text-left font-medium">Dependente</th>
                  <th className="px-3 py-2 text-center font-medium">Tipo</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <DesktopRow key={t.id} transaction={t} categories={categories ?? []} dependents={dependents ?? []}
                    onDescriptionBlur={handleDescriptionBlur} onCategoryChange={handleCategoryChange}
                    onPaymentMethodChange={handlePaymentMethodChange} onDelete={handleOpenDelete} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 space-y-2 md:hidden">
            {transactions.map((t) => (
              <MobileCard key={t.id} transaction={t} categoryMap={categoryMap}
                categories={categories ?? []} dependents={dependents ?? []}
                onDescriptionBlur={handleDescriptionBlur} onCategoryChange={handleCategoryChange}
                onPaymentMethodChange={handlePaymentMethodChange} onDelete={handleOpenDelete} />
            ))}
          </div>

          <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-right">
            <span className="text-sm text-gray-600">Total:</span>
            <span className="ml-2 text-base font-bold">{formatCurrency(total)}</span>
          </div>
        </>
      )}

      <TransactionModal open={modalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} categories={categories ?? []} transaction={editingTransaction} />
      <ConfirmDialog open={deleteDialogOpen} title="Excluir transação" message="Excluir esta transação?" confirmLabel="Excluir" cancelLabel="Cancelar" onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} isLoading={deleteMutation.isPending} />
      <ConfirmDialog open={deleteAllDialogOpen} title="Excluir TODAS" message={`Excluir todas as transações de ${month}?`} confirmLabel="Excluir todas" cancelLabel="Cancelar" onConfirm={handleConfirmDeleteAll} onCancel={handleCancelDeleteAll} isLoading={deleteAllMutation.isPending} />
    </div>
  )
}

// --- Desktop row (table) ---
interface RowProps {
  transaction: Transaction
  categories: Array<{ id: string; name: string }>
  dependents: Array<{ id: string; name: string }>
  onDescriptionBlur: (id: string, v: string, orig: string) => void
  onCategoryChange: (id: string, v: string, orig: string) => void
  onPaymentMethodChange: (id: string, v: string) => void
  onDelete: (t: Transaction) => void
}

function DesktopRow({ transaction: t, categories, dependents, onDescriptionBlur, onCategoryChange, onPaymentMethodChange, onDelete }: RowProps) {
  const [desc, setDesc] = useState(t.description)
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="px-3 py-1.5 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
      <td className="px-3 py-1.5">
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onDescriptionBlur(t.id, desc, t.description)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary" />
      </td>
      <td className={`px-3 py-1.5 text-right text-sm whitespace-nowrap ${t.amount < 0 ? 'text-green-600 font-medium' : ''}`}>{formatCurrency(t.amount)}</td>
      <td className="px-3 py-1.5 text-center text-xs text-gray-500">{t.installmentCurrent && t.installmentTotal ? `${t.installmentCurrent}/${t.installmentTotal}` : '—'}</td>
      <td className="px-3 py-1.5">
        <select value={t.categoryId} onChange={(e) => onCategoryChange(t.id, e.target.value, t.categoryId)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary">
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5"><DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={dependents} /></td>
      <td className="px-3 py-1.5">
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPaymentMethodChange(t.id, e.target.value)}
          className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary">
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5 text-center">
        <button onClick={() => onDelete(t)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </td>
    </tr>
  )
}

// --- Mobile card ---
interface MobileCardProps extends RowProps {
  categoryMap: Map<string, string>
}

function MobileCard({ transaction: t, categoryMap, categories, dependents, onDescriptionBlur, onCategoryChange, onPaymentMethodChange, onDelete }: MobileCardProps) {
  const [desc, setDesc] = useState(t.description)
  const pmInfo = getPaymentMethodInfo((t as any).paymentMethod || 'credito')
  const PmIcon = pmInfo.icon

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      {/* Row 1: date + amount + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PmIcon className={`h-4 w-4 ${pmInfo.color}`} />
          <span className="text-xs text-gray-500">{formatDate(t.date)}</span>
          {t.installmentCurrent && t.installmentTotal && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.installmentCurrent}/{t.installmentTotal}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${t.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(t.amount)}</span>
          <button onClick={() => onDelete(t)} className="rounded p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Row 2: description */}
      <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
        onBlur={() => onDescriptionBlur(t.id, desc, t.description)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary" />

      {/* Row 3: category + payment method + dependent */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <select value={t.categoryId} onChange={(e) => onCategoryChange(t.id, e.target.value, t.categoryId)}
          className="rounded border border-gray-200 bg-gray-50 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPaymentMethodChange(t.id, e.target.value)}
          className="rounded border border-gray-200 bg-gray-50 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
        <DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={dependents} />
      </div>
    </div>
  )
}
