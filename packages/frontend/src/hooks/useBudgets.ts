import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BudgetSummary, SetBudgetPayload } from '@financeiro/shared'

export function useBudgets(month: string) {
  return useQuery<BudgetSummary>({
    queryKey: ['budgets', month],
    queryFn: async () => {
      const { data } = await api.get('/api/budgets', { params: { month } })
      return data
    },
    enabled: !!month,
  })
}

export function useSetBudget() {
  const qc = useQueryClient()
  return useMutation<BudgetSummary, Error, SetBudgetPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.put('/api/budgets', payload)
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['budgets', data.month], data)
    },
  })
}
