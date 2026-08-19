import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Category } from '@financeiro/shared'

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories')
      return data
    },
  })
}
