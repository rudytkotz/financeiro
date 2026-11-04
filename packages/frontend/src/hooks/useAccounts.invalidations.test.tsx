import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useCreateAccount } from './useAccounts'
import { useUpdateRvInvestment } from './useInvestments'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

describe('account and investment invalidations', () => {
  it('invalidates the summary and overview queries after creating an account', async () => {
    apiMock.post.mockResolvedValue({ data: { id: 'acc-1' } })

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCreateAccount(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Nubank',
        type: 'corrente',
        initialBalance: 1000,
        color: '#6366f1',
        closingDay: null,
        dueDay: null,
        creditLimit: null,
        parentAccountId: null,
        dependentId: null,
      })
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'summary'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'overview'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] })
    })
  })

  it('invalidates the investment summary after linking an investment to an account', async () => {
    apiMock.put.mockResolvedValue({ data: { id: 'inv-1' } })

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useUpdateRvInvestment(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'inv-1',
        payload: { accountId: 'acc-1' },
      })
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['investments'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['investments', 'summary'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'summary'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts', 'overview'] })
    })
  })
})
