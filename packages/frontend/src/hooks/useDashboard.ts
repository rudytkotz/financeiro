import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary } from '@financeiro/shared'

export interface DashboardParams {
  month: string
  dependentId?: string  // '' = todos, 'none' = pessoal (sem dependente), uuid = dependente específico
  paymentMethod?: string // '' = todos
}

export function useDashboard({ month, dependentId, paymentMethod }: DashboardParams) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', month, dependentId ?? '', paymentMethod ?? ''],
    queryFn: async () => {
      const params: Record<string, string> = { month }
      if (dependentId) params.dependentId = dependentId
      if (paymentMethod) params.paymentMethod = paymentMethod
      const { data } = await api.get('/api/dashboard', { params })
      return data
    },
    enabled: !!month,
  })
}
