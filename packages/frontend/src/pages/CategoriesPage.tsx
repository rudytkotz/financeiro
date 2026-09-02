import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/useCategories'
import { useCreateCategory } from '@/hooks/useMutations'
import { api } from '@/lib/api'
import { AxiosError } from 'axios'
import { Plus, Tag, Trash2 } from 'lucide-react'

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
    if (!trimmed) { setValidationError('O nome da categoria é obrigatório.'); return }
    if (trimmed.length > 50) { setValidationError('O nome deve ter no máximo 50 caracteres.'); return }

    createCategory.mutate(
      { name: trimmed },
      {
        onSuccess: () => { setName(''); setValidationError(null) },
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

  const userCategories = (categories ?? []).filter((c) => !c.isDefault)
  const defaultCategories = (categories ?? []).filter((c) => c.isDefault)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
          <p className="text-xs text-gray-400 mt-0.5">{(categories ?? []).length} categorias cadastradas</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nova categoria</h2>
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (validationError) setValidationError(null) }}
              placeholder="Ex: Alimentação, Transporte..."
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition ${
                validationError ? 'border-red-400 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
              aria-describedby={validationError ? 'category-error' : undefined}
              aria-invalid={!!validationError}
            />
            {validationError && (
              <p id="category-error" className="mt-1.5 text-xs text-red-600" role="alert">
                {validationError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={createCategory.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 shadow-sm shadow-primary/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {createCategory.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* Erro de exclusão */}
      {deleteError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Categorias do usuário */}
          {userCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Minhas categorias</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {userCategories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-primary/50" />
                      <span className="text-sm font-medium text-gray-800">{category.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setDeleteError(null); deleteCategory.mutate(category.id) }}
                      disabled={deleteCategory.isPending}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition"
                      aria-label={`Excluir categoria ${category.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Categorias padrão */}
          {defaultCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Categorias padrão</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {defaultCategories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                      <span className="text-sm text-gray-600">{category.name}</span>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500">
                      Padrão
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(categories ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma categoria encontrada.</p>
          )}
        </div>
      )}
    </div>
  )
}
