import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Goal, GoalContribution, CreateGoalPayload, AddContributionPayload } from '@financeiro/shared'

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await api.get('/api/goals')
      return data
    },
  })
}

export function useGoalContributions(goalId: string | null) {
  return useQuery<GoalContribution[]>({
    queryKey: ['goals', goalId, 'contributions'],
    queryFn: async () => {
      const { data } = await api.get(`/api/goals/${goalId}/contributions`)
      return data
    },
    enabled: !!goalId,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['goals'] })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation<Goal, Error, CreateGoalPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/goals', payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation<Goal, Error, { id: string; payload: Partial<CreateGoalPayload> & { archived?: boolean } }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/goals/${id}`, payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await api.delete(`/api/goals/${id}`) },
    onSuccess: () => invalidate(qc),
  })
}

export function useAddContribution() {
  const qc = useQueryClient()
  return useMutation<Goal, Error, { goalId: string; payload: AddContributionPayload }>({
    mutationFn: async ({ goalId, payload }) => {
      const { data } = await api.post(`/api/goals/${goalId}/contributions`, payload)
      return data
    },
    onSuccess: (_data, { goalId }) => {
      invalidate(qc)
      qc.invalidateQueries({ queryKey: ['goals', goalId, 'contributions'] })
    },
  })
}
