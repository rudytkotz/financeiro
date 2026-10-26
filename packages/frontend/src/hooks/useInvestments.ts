import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Investment,
  RvPosition,
  RfPosition,
  PortfolioSummary,
  AllocationSlice,
  EvolutionPoint,
  Quote,
  CreateInvestmentRvPayload,
  CreateInvestmentRfPayload,
  CreateInvestmentTransactionPayload,
} from '@financeiro/shared'

export function useInvestments() {
  return useQuery<Investment[]>({
    queryKey: ['investments'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments')
      return data
    },
  })
}

export function useRvPositions() {
  return useQuery<RvPosition[]>({
    queryKey: ['investments', 'positions'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/positions')
      return data
    },
    // Cotações mudam; refetch ao focar na janela
    staleTime: 5 * 60 * 1000,
  })
}

export function usePortfolioSummary() {
  return useQuery<PortfolioSummary>({
    queryKey: ['investments', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/summary')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useRfPositions() {
  return useQuery<RfPosition[]>({
    queryKey: ['investments', 'rf-positions'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/rf-positions')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAllocation() {
  return useQuery<AllocationSlice[]>({
    queryKey: ['investments', 'allocation'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/allocation')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useEvolution() {
  return useQuery<EvolutionPoint[]>({
    queryKey: ['investments', 'evolution'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/evolution')
      return data
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useQuotePreview(ticker: string) {
  return useQuery<Quote>({
    queryKey: ['quote', ticker],
    queryFn: async () => {
      const { data } = await api.get(`/api/investments/quote/${ticker}`)
      return data
    },
    enabled: ticker.trim().length >= 4,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['investments'] })
}

export function useCreateRvInvestment() {
  const qc = useQueryClient()
  return useMutation<Investment, Error, CreateInvestmentRvPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/investments/rv', payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useCreateRfInvestment() {
  const qc = useQueryClient()
  return useMutation<Investment, Error, CreateInvestmentRfPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/investments/rf', payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useAddInvestmentTransaction() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { investmentId: string; payload: CreateInvestmentTransactionPayload }>({
    mutationFn: async ({ investmentId, payload }) => {
      const { data } = await api.post(`/api/investments/${investmentId}/transactions`, payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await api.delete(`/api/investments/${id}`) },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteInvestmentTransaction() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (txId) => { await api.delete(`/api/investments/transactions/${txId}`) },
    onSuccess: () => invalidateAll(qc),
  })
}
