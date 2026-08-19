import { useMemo, useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useDependents } from '@/hooks/useDependents'
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useMutations'
import TransactionModal from '@/components/TransactionModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import DependentSelector from '@/components/DependentSelector'
import type { Transaction } from '@financeiro/shared'

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

export default function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [categoryId, setCategoryId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)

  const filterParams = useMemo(() => {
    const params: Record<string, string> = { month }
    if (categoryId) {
      params.categoryId = categoryId
    }
    if (startDate) {
      params.startDate = startDate
    }
    if (endDate) {
      params.endDate = endDate
    }
    return params
  }, [month, categoryId, startDate, endDate])

  const { data: transactionsData, isLoading } = useTransactions(filterParams)
  const transactions = transactionsData?.transactions ?? []
  const total = transactionsData?.total ?? 0
  const { data: categories } = useCategories()
  const { data: dependents } = useDependents()

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const deleteMutation = useDeleteTransaction()

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    if (categories) {
      for (const cat of categories) {
        map.set(cat.id, cat.name)
      }
    }
    return map
  }, [categories])

  function handleOpenCreate() {
    setEditingTransaction(null)
    setModalOpen(true)
  }

  function handleOpenEdit(transaction: Transaction) {
    setEditingTransaction(transaction)
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transações</h1>
        <button
          onClick={handleOpenCreate}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Nova transação
        </button>
      </div>

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
          <label htmlFor="start-date" className="mb-1 block text-sm font-medium">
            Data início:
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="end-date" className="mb-1 block text-sm font-medium">
            Data fim:
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Carregando...</p>
      ) : !transactions || transactions.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Nenhuma transação encontrada para este período.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium">Valor (R$)</th>
                  <th className="px-4 py-2 text-center font-medium">Parcela</th>
                  <th className="px-4 py-2 text-left font-medium">Portador</th>
                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium">Dependente</th>
                  <th className="px-4 py-2 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{formatDate(t.date)}</td>
                    <td className="px-4 py-2">{t.description}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(t.amount)}</td>
                    <td className="px-4 py-2 text-center text-xs text-gray-500">
                      {t.installmentCurrent && t.installmentTotal
                        ? `${t.installmentCurrent}/${t.installmentTotal}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {t.portador ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      {categoryMap.get(t.categoryId) ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <DependentSelector
                        transactionId={t.id}
                        currentDependentId={t.dependentId}
                        dependents={dependents ?? []}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        Editar
                      </button>
                      {t.source === 'manual' && (
                        <button
                          onClick={() => handleOpenDelete(t)}
                          className="ml-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
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
    </div>
  )
}
