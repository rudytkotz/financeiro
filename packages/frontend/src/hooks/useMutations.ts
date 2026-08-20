import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  SetDependentPayload,
  CreateCategoryPayload,
  CreateDependentPayload,
  SetIncomePayload,
  Transaction,
  Category,
  Dependent,
  Income,
} from '@financeiro/shared'

// --- Transactions ---

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation<Transaction, Error, CreateTransactionPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/transactions', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation<Transaction, Error, { id: string; payload: UpdateTransactionPayload }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/transactions/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/transactions/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSetTransactionDependent() {
  const queryClient = useQueryClient()
  return useMutation<Transaction, unknown, { id: string; payload: SetDependentPayload }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/transactions/${id}/dependent`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// --- Categories ---

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation<Category, Error, CreateCategoryPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/categories', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

// --- Dependents ---

export function useCreateDependent() {
  const queryClient = useQueryClient()
  return useMutation<Dependent, Error, CreateDependentPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/dependents', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependents'] })
    },
  })
}

// --- Income ---

export function useSetIncome() {
  const queryClient = useQueryClient()
  return useMutation<Income, Error, { month: string; payload: SetIncomePayload }>({
    mutationFn: async ({ month, payload }) => {
      const { data } = await api.put(`/api/income/${month}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// --- Import CSV ---

export interface ImportCsvPayload {
  transactions: Array<{
    date: string
    description: string
    amount: number
    categoryId: string
    dependentId: string | null
    source: 'csv'
    importId: string | null
    portador?: string | null
    installmentCurrent?: number | null
    installmentTotal?: number | null
  }>
  referenceMonth: string
  force?: boolean
}

export function useImportCsv() {
  const queryClient = useQueryClient()
  return useMutation<{ importId: string; transactionCount: number }, Error, ImportCsvPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/imports', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
