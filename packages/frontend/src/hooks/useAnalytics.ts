import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  MonthComparison, CashFlowForecast, NetWorthPoint, YearlyReport,
  TransactionSearchResult, CompoundSimInput, CompoundSimResult,
} from '@financeiro/shared'

export function useMonthComparison(month: string, lookback = 3) {
  return useQuery<MonthComparison>({
    queryKey: ['analytics', 'comparison', month, lookback],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/comparison', { params: { month, lookback } })
      return data
    },
    enabled: !!month,
  })
}

export function useCashFlow(month: string) {
  return useQuery<CashFlowForecast>({
    queryKey: ['analytics', 'cashflow', month],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/cashflow', { params: { month } })
      return data
    },
    enabled: !!month,
  })
}

export function useNetWorth(months = 12) {
  return useQuery<NetWorthPoint[]>({
    queryKey: ['analytics', 'networth', months],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/networth', { params: { months } })
      return data
    },
  })
}

export function useYearlyReport(year: number) {
  return useQuery<YearlyReport>({
    queryKey: ['analytics', 'yearly', year],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/yearly', { params: { year } })
      return data
    },
  })
}

export function useTransactionSearch(query: string) {
  return useQuery<TransactionSearchResult>({
    queryKey: ['analytics', 'search', query],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/search', { params: { q: query } })
      return data
    },
    enabled: query.trim().length >= 2,
  })
}

export function useSimulate() {
  return useMutation<CompoundSimResult, Error, CompoundSimInput>({
    mutationFn: async (input) => {
      const { data } = await api.post('/api/analytics/simulate', input)
      return data
    },
  })
}
