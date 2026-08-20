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
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'

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
  const [searchText, setSearchText] = useState<string>('')

  // Sort state (client-side)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)

  // Delete ALL confirmation state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)

  const filterParams = useMemo(() => {
    const params: Record<string, string> = { month }
    if (categoryId) {
      params.categoryId = categoryId
    }
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
      for (const cat of categories) {
        map.set(cat.id, cat.name)
      }
    }
    return map
  }, [categories])

  // Client-side filtering and sorting
  const transactions = useMemo(() => {
    let filtered = rawTransactions

    // Filter by dependent
    if (dependentId) {
      filtered = filtered.filter((t) => t.dependentId === dependentId)
    }

    // Filter by search text (description)
    if (searchText.trim()) {
      const lower = searchText.toLowerCase()
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(lower))
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date':
          cmp = a.date.localeCompare(b.date)
          break
        case 'description':
          cmp = a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'category':
          cmp = (categoryMap.get(a.categoryId) ?? '').localeCompare(categoryMap.get(b.categoryId) ?? '', 'pt-BR')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [rawTransactions, dependentId, searchText, sortField, sortDir, categoryMap])

  const total = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions])

  // --- Sort handler ---
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return field
      }
      setSortDir('asc')
      return field
    })
  }, [])

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />
  }

  // --- Modal handlers ---
  function handleOpenCreate() {
    setEditingTransaction(null)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setEditingTransaction(null)
  }

  async function handleSubmit(data: { date: string; description: string; amount: number; categoryId: string }) {
    if (editingTransaction) {
      await updateMutation.mutateAsync({ id: editingTransaction.id, payload: data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  // --- Delete single ---
  function handleOpenDelete(transaction: Transaction) {
    setTransactionToDelete(transaction)
    setDeleteDialogOpen(true)
  }

  function handleCancelDelete() {
    setDeleteDialogOpen(false)
    setTransactionToDelete(null)
  }

  async function handleConfirmDelete() {
    if (!transactionToDelete) return
    await deleteMutation.mutateAsync(transactionToDelete.id)
    setDeleteDialogOpen(false)
    setTransactionToDelete(null)
  }

  // --- Delete ALL ---
  function handleOpenDeleteAll() {
    setDeleteAllDialogOpen(true)
  }

  function handleCancelDeleteAll() {
    setDeleteAllDialogOpen(false)
  }

  async function handleConfirmDeleteAll() {
    await deleteAllMutation.mutateAsync(month)
    setDeleteAllDialogOpen(false)
  }

  // --- Inline field update (debounced on blur/enter) ---
  const handleDescriptionBlur = useCallback(
    async (id: string, newValue: string, originalValue: string) => {
      const trimmed = newValue.trim()
      if (!trimmed || trimmed === originalValue) return
      await updateMutation.mutateAsync({ id, payload: { description: trimmed } })
    },
    [updateMutation]
  )

  const handleCategoryChange = useCallback(
    async (id: string, newCategoryId: string, originalCategoryId: string) => {
      if (newCategoryId === originalCategoryId) return
      await updateMutation.mutateAsync({ id, payload: { categoryId: newCategoryId } })
    },
    [updateMutation]
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transações</h1>
        <div className="flex items-center gap-2">
          {rawTransactions.length > 0 && (
            <button
              onClick={handleOpenDeleteAll}
              className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Excluir todas
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Nova transação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="month-selector" className="mb-1 block text-sm font-medium">
            Mês:
          </label>
          <input
            id="month-selector"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="category-filter" className="mb-1 block text-sm font-medium">
            Categoria:
          </label>
          <select
            id="category-filter"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dependent-filter" className="mb-1 block text-sm font-medium">
            Dependente:
          </label>
          <select
            id="dependent-filter"
            value={dependentId}
            onChange={(e) => setDependentId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos</option>
            {dependents?.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-text" className="mb-1 block text-sm font-medium">
            Buscar:
          </label>
          <input
            id="search-text"
            type="text"
            placeholder="Buscar descrição..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Nenhuma transação encontrada para este período.
        </p>
      ) : (
        <>
          <div className="mt-4 text-xs text-gray-500">
            {transactions.length} transação(ões) • Total: {formatCurrency(total)}
          </div>

          <div className="mt-2 overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th
                    className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => handleSort('date')}
                  >
                    Data <SortIcon field="date" />
                  </th>
                  <th
                    className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => handleSort('description')}
                  >
                    Descrição <SortIcon field="description" />
                  </th>
                  <th
                    className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => handleSort('amount')}
                  >
                    Valor <SortIcon field="amount" />
                  </th>
                  <th className="px-3 py-2 text-center font-medium">Parcela</th>
                  <th
                    className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => handleSort('category')}
                  >
                    Categoria <SortIcon field="category" />
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Dependente</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <InlineRow
                    key={t.id}
                    transaction={t}
                    categories={categories ?? []}
                    dependents={dependents ?? []}
                    onDescriptionBlur={handleDescriptionBlur}
                    onCategoryChange={handleCategoryChange}
                    onDelete={handleOpenDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-right text-sm font-semibold">
            Total: {formatCurrency(total)}
          </div>
        </>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        categories={categories ?? []}
        transaction={editingTransaction}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Excluir transação"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={deleteAllDialogOpen}
        title="Excluir TODAS as transações"
        message={`Tem certeza que deseja excluir TODAS as transações do mês ${month}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir todas"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteAll}
        onCancel={handleCancelDeleteAll}
        isLoading={deleteAllMutation.isPending}
      />
    </div>
  )
}

// --------------------------------------------------------------------------
// Inline editable row component
// --------------------------------------------------------------------------

interface InlineRowProps {
  transaction: Transaction
  categories: Array<{ id: string; name: string }>
  dependents: Array<{ id: string; name: string }>
  onDescriptionBlur: (id: string, newValue: string, original: string) => void
  onCategoryChange: (id: string, newCatId: string, original: string) => void
  onDelete: (t: Transaction) => void
}

function InlineRow({
  transaction: t,
  categories,
  dependents,
  onDescriptionBlur,
  onCategoryChange,
  onDelete,
}: InlineRowProps) {
  const [desc, setDesc] = useState(t.description)

  // Sync if server data changes
  if (desc !== t.description && document.activeElement?.getAttribute('data-txid') !== t.id) {
    // Only sync if user is not currently editing this field
  }

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="px-3 py-1.5 text-xs">{formatDate(t.date)}</td>

      {/* Descrição - always editable */}
      <td className="px-3 py-1.5">
        <input
          type="text"
          data-txid={t.id}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onDescriptionBlur(t.id, desc, t.description)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="w-full rounded border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </td>

      <td className={`px-3 py-1.5 text-right text-sm ${t.amount < 0 ? 'text-green-600 font-medium' : ''}`}>
        {formatCurrency(t.amount)}
      </td>

      <td className="px-3 py-1.5 text-center text-xs text-gray-500">
        {t.installmentCurrent && t.installmentTotal
          ? `${t.installmentCurrent}/${t.installmentTotal}`
          : '—'}
      </td>

      {/* Categoria - always editable */}
      <td className="px-3 py-1.5">
        <select
          value={t.categoryId}
          onChange={(e) => onCategoryChange(t.id, e.target.value, t.categoryId)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </td>

      {/* Dependente */}
      <td className="px-3 py-1.5">
        <DependentSelector
          transactionId={t.id}
          currentDependentId={t.dependentId}
          dependents={dependents}
        />
      </td>

      {/* Delete */}
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={() => onDelete(t)}
          className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
