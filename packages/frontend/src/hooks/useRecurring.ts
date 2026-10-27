import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RecurringTransaction, CreateRecurringPayload } from '@financeiro/shared'

export function useRecurring() {
  return useQuery<RecurringTransaction[]>({
    queryKey: ['recurring'],
    queryFn: async () => {
      const { data } = await api.get('/api/recurring')
      return data
    },
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['recurring'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation<RecurringTransaction, Error, CreateRecurringPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/recurring', payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation<RecurringTransaction, Error, { id: string; payload: Partial<CreateRecurringPayload> & { active?: boolean } }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/recurring/${id}`, payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await api.delete(`/api/recurring/${id}`) },
    onSuccess: () => invalidate(qc),
  })
}

export function useMaterializeRecurring() {
  const qc = useQueryClient()
  return useMutation<{ created: number }, Error, string>({
    mutationFn: async (month) => {
      const { data } = await api.post('/api/recurring/materialize', null, { params: { month } })
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}
