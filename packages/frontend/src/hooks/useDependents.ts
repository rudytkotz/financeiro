import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Dependent } from '@financeiro/shared'

export function useDependents() {
  return useQuery<Dependent[]>({
    queryKey: ['dependents'],
    queryFn: async () => {
      const { data } = await api.get('/api/dependents')
      return data
    },
  })
}
