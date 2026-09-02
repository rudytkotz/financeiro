import { useState } from 'react'
import { useDependents } from '@/hooks/useDependents'
import { useCreateDependent } from '@/hooks/useMutations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AxiosError } from 'axios'
import { Plus, Users, Trash2 } from 'lucide-react'

interface ApiErrorResponse {
  statusCode: number
  code: string
  message: string
}

export default function DependentsPage() {
  const { data: dependents = [], isLoading } = useDependents()
  const createMutation = useCreateDependent()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation<void, AxiosError<ApiErrorResponse>, string>({
    mutationFn: async (id: string) => { await api.delete(`/api/dependents/${id}`) },
    onSuccess: () => { setDeleteError(null); queryClient.invalidateQueries({ queryKey: ['dependents'] }) },
    onError: (error) => {
      const data = error.response?.data
      if (error.response?.status === 409 && data?.code === 'HAS_TRANSACTIONS') {
        setDeleteError('Não é possível excluir este dependente pois existem transações vinculadas a ele.')
      } else {
        setDeleteError('Ocorreu um erro ao excluir o dependente.')
      }
    },
  })

  const isAtLimit = dependents.length >= 10

  function validate(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return 'O nome do dependente é obrigatório.'
    if (trimmed.length > 50) return 'O nome deve ter no máximo 50 caracteres.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)
    setDeleteError(null)
    const error = validate(name)
    if (error) { setValidationError(error); return }
    setValidationError(null)

    createMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: () => { setName(''); setApiError(null) },
        onError: (err) => {
          const axiosError = err as AxiosError<ApiErrorResponse>
          const data = axiosError.response?.data
          if (axiosError.response?.status === 409 && data?.code === 'DUPLICATE_NAME') {
            setApiError('Já existe um dependente com esse nome.')
          } else {
            setApiError('Ocorreu um erro ao criar o dependente.')
          }
        },
      }
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dependentes</h1>
            <p className="text-xs text-gray-400 mt-0.5">Pessoas associadas às suas transações</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isAtLimit ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {dependents.length}/10
        </span>
      </div>

      {/* Formulário */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Adicionar dependente</h2>
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (validationError) setValidationError(null)
                if (apiError) setApiError(null)
              }}
              placeholder="Ex: Maria, João..."
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition ${
                validationError || apiError ? 'border-red-400 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
              disabled={isAtLimit}
              aria-label="Nome do dependente"
            />
            {(validationError || apiError) && (
              <p className="mt-1.5 text-xs text-red-600">{validationError || apiError}</p>
            )}
            {isAtLimit && !validationError && !apiError && (
              <p className="mt-1.5 text-xs text-amber-600">Limite de 10 dependentes atingido.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isAtLimit || createMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 shadow-sm shadow-violet-200 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* Erro de exclusão */}
      {deleteError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {deleteError}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-500" />
        </div>
      ) : dependents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-2xl bg-gray-100 p-5 mb-3">
            <Users className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">Nenhum dependente cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">Adicione pessoas para associar às transações</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {dependents.map((dependent) => (
              <li key={dependent.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                    {dependent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{dependent.name}</span>
                </div>
                <button
                  onClick={() => { setDeleteError(null); setApiError(null); deleteMutation.mutate(dependent.id) }}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition"
                  aria-label={`Excluir ${dependent.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
