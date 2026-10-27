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
  DividendSummary,
  MaturityAlert,
  PortfolioSnapshot,
  AllocationTarget,
  RebalanceRow,
  TaxReport,
  CreateDividendPayload,
  SetTargetPayload,
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

export function useQuotePreview(ticker: string, generic = false) {
  return useQuery<Quote>({
    queryKey: ['quote', ticker, generic],
    queryFn: async () => {
      const { data } = await api.get(`/api/investments/quote/${encodeURIComponent(ticker)}`, {
        params: generic ? { generic: '1' } : undefined,
      })
      return data
    },
    enabled: ticker.trim().length >= 3,
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

export function useUpdateRvInvestment() {
  const qc = useQueryClient()
  return useMutation<Investment, Error, { id: string; payload: { ticker?: string; name?: string; assetClass?: string } }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/investments/rv/${id}`, payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateRfInvestment() {
  const qc = useQueryClient()
  return useMutation<Investment, Error, { id: string; payload: Partial<CreateInvestmentRfPayload> }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/investments/rf/${id}`, payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateInvestmentTransaction() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { txId: string; payload: Partial<CreateInvestmentTransactionPayload> }>({
    mutationFn: async ({ txId, payload }) => {
      const { data } = await api.put(`/api/investments/transactions/${txId}`, payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateDividend() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; payload: Partial<CreateDividendPayload> }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.put(`/api/investments/dividends/${id}`, payload)
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

// ---- Proventos ----

export function useDividends() {
  return useQuery<DividendSummary>({
    queryKey: ['investments', 'dividends'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/dividends')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useDividendForecast() {
  return useQuery<import('@financeiro/shared').DividendForecast>({
    queryKey: ['investments', 'dividends', 'forecast'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/dividends/forecast')
      return data
    },
    staleTime: 30 * 60 * 1000,
  })
}

export function useAddDividend() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, CreateDividendPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/investments/dividends', payload)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteDividend() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await api.delete(`/api/investments/dividends/${id}`) },
    onSuccess: () => invalidateAll(qc),
  })
}

// ---- Alertas de vencimento ----

export function useMaturityAlerts() {
  return useQuery<MaturityAlert[]>({
    queryKey: ['investments', 'maturity-alerts'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/maturity-alerts')
      return data
    },
    staleTime: 60 * 60 * 1000,
  })
}

// ---- Snapshots ----

export function useSnapshots() {
  return useQuery<PortfolioSnapshot[]>({
    queryKey: ['investments', 'snapshots'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/snapshots')
      return data
    },
    staleTime: 10 * 60 * 1000,
  })
}

// ---- Rebalanceamento ----

export function useAllocationTargets() {
  return useQuery<AllocationTarget[]>({
    queryKey: ['investments', 'targets'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/targets')
      return data
    },
  })
}

export function useRebalance() {
  return useQuery<RebalanceRow[]>({
    queryKey: ['investments', 'rebalance'],
    queryFn: async () => {
      const { data } = await api.get('/api/investments/rebalance')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetTargets() {
  const qc = useQueryClient()
  return useMutation<AllocationTarget[], Error, SetTargetPayload[]>({
    mutationFn: async (targets) => {
      const { data } = await api.put('/api/investments/targets', { targets })
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

// ---- Relatório de IR ----

export function useTaxReport(year: number) {
  return useQuery<TaxReport>({
    queryKey: ['investments', 'tax-report', year],
    queryFn: async () => {
      const { data } = await api.get(`/api/investments/tax-report?year=${year}`)
      return data
    },
    staleTime: 10 * 60 * 1000,
  })
}
