import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Account, CreateAccountPayload } from '@financeiro/shared'

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get('/api/accounts')
      return data
    },
  })
}

export function useInvoice(accountId: string | null, month: string) {
  return useQuery<import('@financeiro/shared').InvoiceSummary>({
    queryKey: ['invoice', accountId, month],
    queryFn: async () => {
      const { data } = await api.get('/api/accounts/invoice', { params: { accountId, month } })
      return data
    },
    enabled: !!accountId && !!month,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['accounts'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation<Account, Error, CreateAccountPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/accounts', payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation<Account, Error, { id: string; payload: Partial<CreateAccountPayload> & { archived?: boolean } }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/accounts/${id}`, payload)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/accounts/${id}`)
    },
    onSuccess: () => invalidate(qc),
  })
}
