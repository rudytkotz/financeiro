import { useState } from 'react'
import { useDependents } from '@/hooks/useDependents'
import { useCreateDependent } from '@/hooks/useMutations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AxiosError } from 'axios'

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
    mutationFn: async (id: string) => {
      await api.delete(`/api/dependents/${id}`)
    },
    onSuccess: () => {
      setDeleteError(null)
      queryClient.invalidateQueries({ queryKey: ['dependents'] })
    },
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
    if (!trimmed) {
      return 'O nome do dependente é obrigatório.'
    }
    if (trimmed.length > 50) {
      return 'O nome do dependente deve ter no máximo 50 caracteres.'
    }
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)
    setDeleteError(null)

    const error = validate(name)
    if (error) {
      setValidationError(error)
      return
    }

    setValidationError(null)

    createMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('')
          setApiError(null)
        },
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

  function handleDelete(id: string) {
    setDeleteError(null)
    setApiError(null)
    deleteMutation.mutate(id)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Dependentes</h1>
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dependentes</h1>
        <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
          {dependents.length}/10 dependentes
        </span>
      </div>

      {/* Formulário de criação */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (validationError) setValidationError(null)
                if (apiError) setApiError(null)
              }}
              placeholder="Nome do dependente"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationError || apiError ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isAtLimit}
              aria-label="Nome do dependente"
            />
          </div>
          <button
            type="submit"
            disabled={isAtLimit || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
        {validationError && (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        )}
        {apiError && (
          <p className="mt-1 text-sm text-red-600">{apiError}</p>
        )}
        {isAtLimit && !validationError && !apiError && (
          <p className="mt-1 text-sm text-amber-600">
            Limite máximo de 10 dependentes atingido.
          </p>
        )}
      </form>

      {/* Mensagem de erro ao excluir */}
      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {/* Lista de dependentes */}
      {dependents.length === 0 ? (
        <p className="text-gray-500">Nenhum dependente cadastrado.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
          {dependents.map((dependent) => (
            <li
              key={dependent.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-gray-900">{dependent.name}</span>
              <button
                onClick={() => handleDelete(dependent.id)}
                disabled={deleteMutation.isPending}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                aria-label={`Excluir ${dependent.name}`}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
