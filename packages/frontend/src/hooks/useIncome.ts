import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Income } from '@financeiro/shared'

export function useIncome(month: string) {
  return useQuery<Income | null>({
    queryKey: ['income', month],
    queryFn: async () => {
      const { data } = await api.get('/api/income', { params: { month } })
      return data
    },
    enabled: !!month,
  })
}
