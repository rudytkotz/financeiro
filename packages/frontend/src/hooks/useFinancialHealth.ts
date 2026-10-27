import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FinancialHealth } from '@financeiro/shared'

export function useFinancialHealth() {
  return useQuery<FinancialHealth>({
    queryKey: ['dashboard', 'health'],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard/health')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
