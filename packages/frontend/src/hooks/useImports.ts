import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Import } from '@financeiro/shared'

export function useImports() {
  return useQuery<Import[]>({
    queryKey: ['imports'],
    queryFn: async () => {
      const { data } = await api.get('/api/imports')
      return data
    },
  })
}
