import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardSummary } from '@financeiro/shared'

export function useDashboard(month: string) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', month],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard', { params: { month } })
      return data
    },
    enabled: !!month,
  })
}
