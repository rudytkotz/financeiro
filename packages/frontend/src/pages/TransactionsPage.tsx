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
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, CreditCard, Smartphone, Banknote, Wallet } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'credito', label: 'Cartão de Crédito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
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
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
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
    if (categories) {
      for (const cat of categories) map.set(cat.id, cat.name)
    }
    return map
  }, [categories])

  // Client-side filtering and sorting
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

  // Group by payment method
  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const method = (t as any).paymentMethod || 'credito'
      if (!groups.has(method)) groups.set(method, [])
      groups.get(method)!.push(t)
    }
    // Sort groups by the order in PAYMENT_METHODS
    const ordered: Array<{ method: string; transactions: Transaction[]; subtotal: number }> = []
    for (const pm of PAYMENT_METHODS) {
      const txs = groups.get(pm.value)
      if (txs && txs.length > 0) {
        ordered.push({ method: pm.value, transactions: txs, subtotal: txs.reduce((s, t) => s + t.amount, 0) })
      }
    }
    return ordered
  }, [transactions])

  const total = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return field }
      setSortDir('asc')
      return field
    })
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

  function handleOpenDelete(transaction: Transaction) { setTransactionToDelete(transaction); setDeleteDialogOpen(true) }
  function handleCancelDelete() { setDeleteDialogOpen(false); setTransactionToDelete(null) }
  async function handleConfirmDelete() { if (!transactionToDelete) return; await deleteMutation.mutateAsync(transactionToDelete.id); setDeleteDialogOpen(false); setTransactionToDelete(null) }

  function handleOpenDeleteAll() { setDeleteAllDialogOpen(true) }
  function handleCancelDeleteAll() { setDeleteAllDialogOpen(false) }
  async function handleConfirmDeleteAll() { await deleteAllMutation.mutateAsync(month); setDeleteAllDialogOpen(false) }

  const handleDescriptionBlur = useCallback(async (id: string, newValue: string, original: string) => {
    const trimmed = newValue.trim()
    if (!trimmed || trimmed === original) return
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transações</h1>
        <div className="flex items-center gap-2">
          {rawTransactions.length > 0 && (
            <button onClick={handleOpenDeleteAll} className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Excluir todas
            </button>
          )}
          <button onClick={handleOpenCreate} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Nova transação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="month-selector" className="mb-1 block text-xs font-medium text-gray-600">Mês</label>
          <input id="month-selector" type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label htmlFor="payment-filter" className="mb-1 block text-xs font-medium text-gray-600">Forma de pagamento</label>
          <select id="payment-filter" value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todas</option>
            {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category-filter" className="mb-1 block text-xs font-medium text-gray-600">Categoria</label>
          <select id="category-filter" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todas</option>
            {categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dependent-filter" className="mb-1 block text-xs font-medium text-gray-600">Dependente</label>
          <select id="dependent-filter" value={dependentId} onChange={(e) => setDependentId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos</option>
            {dependents?.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="search-text" className="mb-1 block text-xs font-medium text-gray-600">Buscar</label>
          <input id="search-text" type="text" placeholder="Descrição..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Nenhuma transação encontrada para este período.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {grouped.map(({ method, transactions: txs, subtotal }) => {
              const info = getPaymentMethodInfo(method)
              const Icon = info.icon
              return (
                <div key={method} className={`rounded-lg border p-3 ${info.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${info.color}`} />
                    <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</p>
                  <p className="text-xs text-gray-500">{txs.length} item(ns)</p>
                </div>
              )
            })}
          </div>

          {/* Grouped tables */}
          {grouped.map(({ method, transactions: txs, subtotal }) => {
            const info = getPaymentMethodInfo(method)
            const Icon = info.icon
            return (
              <div key={method} className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${info.color}`} />
                  <h2 className={`text-sm font-semibold ${info.color}`}>{info.label}</h2>
                  <span className="text-xs text-gray-400">({txs.length})</span>
                  <span className="ml-auto text-sm font-semibold text-gray-700">{formatCurrency(subtotal)}</span>
                </div>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => handleSort('date')}>
                          Data <SortIcon field="date" />
                        </th>
                        <th className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => handleSort('description')}>
                          Descrição <SortIcon field="description" />
                        </th>
                        <th className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => handleSort('amount')}>
                          Valor <SortIcon field="amount" />
                        </th>
                        <th className="px-3 py-2 text-center font-medium">Parcela</th>
                        <th className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => handleSort('category')}>
                          Categoria <SortIcon field="category" />
                        </th>
                        <th className="px-3 py-2 text-left font-medium">Dependente</th>
                        <th className="px-3 py-2 text-center font-medium">Tipo</th>
                        <th className="w-10 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((t) => (
                        <InlineRow
                          key={t.id}
                          transaction={t}
                          categories={categories ?? []}
                          dependents={dependents ?? []}
                          onDescriptionBlur={handleDescriptionBlur}
                          onCategoryChange={handleCategoryChange}
                          onPaymentMethodChange={handlePaymentMethodChange}
                          onDelete={handleOpenDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          <div className="mt-6 rounded-lg border border-gray-300 bg-gray-50 p-4 text-right">
            <span className="text-sm text-gray-600">Total geral:</span>
            <span className="ml-2 text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>
        </>
      )}

      <TransactionModal open={modalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} categories={categories ?? []} transaction={editingTransaction} />
      <ConfirmDialog open={deleteDialogOpen} title="Excluir transação" message="Tem certeza que deseja excluir esta transação?" confirmLabel="Excluir" cancelLabel="Cancelar" onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} isLoading={deleteMutation.isPending} />
      <ConfirmDialog open={deleteAllDialogOpen} title="Excluir TODAS as transações" message={`Excluir TODAS as transações do mês ${month}?`} confirmLabel="Excluir todas" cancelLabel="Cancelar" onConfirm={handleConfirmDeleteAll} onCancel={handleCancelDeleteAll} isLoading={deleteAllMutation.isPending} />
    </div>
  )
}

// --------------------------------------------------------------------------
// Inline editable row
// --------------------------------------------------------------------------

interface InlineRowProps {
  transaction: Transaction
  categories: Array<{ id: string; name: string }>
  dependents: Array<{ id: string; name: string }>
  onDescriptionBlur: (id: string, newValue: string, original: string) => void
  onCategoryChange: (id: string, newCatId: string, original: string) => void
  onPaymentMethodChange: (id: string, newMethod: string) => void
  onDelete: (t: Transaction) => void
}

function InlineRow({ transaction: t, categories, dependents, onDescriptionBlur, onCategoryChange, onPaymentMethodChange, onDelete }: InlineRowProps) {
  const [desc, setDesc] = useState(t.description)

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="px-3 py-1.5 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
      <td className="px-3 py-1.5">
        <input type="text" data-txid={t.id} value={desc} onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onDescriptionBlur(t.id, desc, t.description)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="w-full rounded border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary" />
      </td>
      <td className={`px-3 py-1.5 text-right text-sm whitespace-nowrap ${t.amount < 0 ? 'text-green-600 font-medium' : ''}`}>
        {formatCurrency(t.amount)}
      </td>
      <td className="px-3 py-1.5 text-center text-xs text-gray-500">
        {t.installmentCurrent && t.installmentTotal ? `${t.installmentCurrent}/${t.installmentTotal}` : '—'}
      </td>
      <td className="px-3 py-1.5">
        <select value={t.categoryId} onChange={(e) => onCategoryChange(t.id, e.target.value, t.categoryId)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary">
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={dependents} />
      </td>
      <td className="px-3 py-1.5">
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPaymentMethodChange(t.id, e.target.value)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary">
          {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5 text-center">
        <button onClick={() => onDelete(t)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
