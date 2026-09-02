import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,   // 1 min — evita refetch desnecessário ao trocar de aba
      gcTime: 5 * 60 * 1000,  // 5 min — mantém cache em memória
      retry: 1,
      refetchOnWindowFocus: false, // não re-busca ao focar a janela
    },
  },
})
