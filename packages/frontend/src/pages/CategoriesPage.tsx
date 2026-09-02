import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/useCategories'
import { useCreateCategory } from '@/hooks/useMutations'
import { api } from '@/lib/api'
import { AxiosError } from 'axios'
import { Plus, Tag, Trash2, Check, X, Pencil } from 'lucide-react'
import type { Category } from '@financeiro/shared'

// ---------------------------------------------------------------------------
// Inline editable row
// ---------------------------------------------------------------------------
function CategoryRow({
  category,
  onRename,
  onDelete,
  isDeleting,
}: {
  category: Category
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(category.name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === category.name) { setEditing(false); setValue(category.name); return }
    setSaving(true)
    try {
      await onRename(category.id, trimmed)
      setEditing(false)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(category.name)
    setEditing(false)
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/50 transition group">
      <div className={`h-2 w-2 flex-shrink-0 rounded-full ${category.isDefault ? 'bg-primary/40' : 'bg-primary/70'}`} />

      {editing ? (
        <>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            className="flex-1 rounded-lg border border-primary/40 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 disabled:opacity-40 transition"
            title="Salvar">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition"
            title="Cancelar">
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium text-gray-800">{category.name}</span>
          {category.isDefault && (
            <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary/60 mr-1">
              padrão
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500 transition"
            title="Renomear">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition"
            title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CategoriesPage() {
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()

  const renameMutation = useMutation<Category, AxiosError<{ code: string; message: string }>, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const { data } = await api.put(`/api/categories/${id}`, { name })
      return data
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Category[]>(['categories'], (old) =>
        old ? old.map((c) => (c.id === updated.id ? updated : c)) : old
      )
      setActionError(null)
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        setActionError('Já existe uma categoria com esse nome.')
      } else {
        setActionError('Erro ao renomear a categoria.')
      }
    },
  })

  const deleteMutation = useMutation<void, AxiosError<{ code: string; message: string }>, string>({
    mutationFn: async (id) => { await api.delete(`/api/categories/${id}`) },
    onSuccess: (_, id) => {
      queryClient.setQueryData<Category[]>(['categories'], (old) =>
        old ? old.filter((c) => c.id !== id) : old
      )
      setActionError(null)
    },
    onError: (error) => {
      if (error.response?.status === 409 && error.response.data?.code === 'HAS_TRANSACTIONS') {
        setActionError('Não é possível excluir uma categoria com transações vinculadas.')
      } else {
        setActionError('Erro ao excluir a categoria.')
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)
    setActionError(null)
    const trimmed = name.trim()
    if (!trimmed) { setValidationError('O nome é obrigatório.'); return }
    if (trimmed.length > 50) { setValidationError('Máximo de 50 caracteres.'); return }

    createCategory.mutate(
      { name: trimmed },
      {
        onSuccess: () => { setName(''); setValidationError(null) },
        onError: (error) => {
          const axiosError = error as AxiosError<{ code: string; message: string }>
          if (axiosError.response?.status === 409) {
            setValidationError('Já existe uma categoria com este nome.')
          } else {
            setValidationError('Erro ao criar a categoria.')
          }
        },
      }
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {(categories ?? []).length} categorias · clique no lápis para renomear
          </p>
        </div>
      </div>

      {/* Formulário de criação */}
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
              aria-invalid={!!validationError}
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-600" role="alert">{validationError}</p>
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

      {/* Erro de ação */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between" role="alert">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-3 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      ) : (categories ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhuma categoria encontrada.</p>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {(categories ?? []).map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onRename={(id, newName) => renameMutation.mutateAsync({ id, name: newName })}
                onDelete={(id) => { setActionError(null); deleteMutation.mutate(id) }}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
