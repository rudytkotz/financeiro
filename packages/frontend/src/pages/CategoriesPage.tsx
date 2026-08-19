import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/useCategories'
import { useCreateCategory } from '@/hooks/useMutations'
import { api } from '@/lib/api'
import { AxiosError } from 'axios'

export default function CategoriesPage() {
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()

  const deleteCategory = useMutation<void, AxiosError<{ code: string; message: string }>, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/api/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setDeleteError(null)
    },
    onError: (error) => {
      if (error.response?.status === 409 && error.response.data?.code === 'HAS_TRANSACTIONS') {
        setDeleteError('Não é possível excluir uma categoria com transações vinculadas.')
      } else {
        setDeleteError('Ocorreu um erro ao excluir a categoria.')
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    const trimmed = name.trim()

    if (!trimmed) {
      setValidationError('O nome da categoria é obrigatório.')
      return
    }
    if (trimmed.length > 50) {
      setValidationError('O nome da categoria deve ter no máximo 50 caracteres.')
      return
    }

    createCategory.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setName('')
          setValidationError(null)
        },
        onError: (error) => {
          const axiosError = error as AxiosError<{ code: string; message: string }>
          if (axiosError.response?.status === 409) {
            setValidationError('Já existe uma categoria com este nome.')
          } else {
            setValidationError('Ocorreu um erro ao criar a categoria.')
          }
        },
      }
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Categorias</h1>

      {/* Formulário de criação */}
      <form onSubmit={handleSubmit} className="mt-6 flex items-start gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (validationError) setValidationError(null)
            }}
            placeholder="Nome da nova categoria"
            className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              validationError ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-describedby={validationError ? 'category-error' : undefined}
            aria-invalid={!!validationError}
          />
          {validationError && (
            <p id="category-error" className="mt-1 text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={createCategory.isPending}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      {/* Mensagem de erro de exclusão */}
      {deleteError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {deleteError}
        </p>
      )}

      {/* Listagem */}
      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Carregando...</p>
      ) : !categories || categories.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Nenhuma categoria encontrada.</p>
      ) : (
        <ul className="mt-6 divide-y rounded border">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{category.name}</span>
                {category.isDefault && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Padrão
                  </span>
                )}
              </div>
              {!category.isDefault && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    deleteCategory.mutate(category.id)
                  }}
                  disabled={deleteCategory.isPending}
                  className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Excluir categoria ${category.name}`}
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
