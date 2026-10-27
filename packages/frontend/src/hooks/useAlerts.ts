import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Alert } from '@financeiro/shared'

export function useAlerts() {
  return useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get('/api/alerts')
      return data
    },
    staleTime: 2 * 60 * 1000,
  })
}
