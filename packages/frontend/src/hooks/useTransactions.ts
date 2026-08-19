import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Transaction } from '@financeiro/shared'

export interface TransactionsParams {
  month?: string
  categoryId?: string
  startDate?: string
  endDate?: string
  sort?: string
}

interface TransactionsResponse {
  transactions: Transaction[]
  total: number
}

export function useTransactions(params: TransactionsParams = {}) {
  return useQuery<TransactionsResponse>({
    queryKey: ['transactions', params],
    queryFn: async () => {
      const { data } = await api.get('/api/transactions', { params })
      return data
    },
  })
}
