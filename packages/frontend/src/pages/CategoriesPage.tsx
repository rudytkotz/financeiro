import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/useCategories'
import { useCreateCategory } from '@/hooks/useMutations'
import { api } from '@/lib/api'
import { AxiosError } from 'axios'
import { Plus, Tag, Trash2, Check, X, Pencil, Palette } from 'lucide-react'
import type { Category } from '@financeiro/shared'

// ---------------------------------------------------------------------------
// Palette of preset colors the user can pick
// ---------------------------------------------------------------------------
const COLOR_PRESETS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#0ea5e9', // sky
  '#a16207', // amber dark
  '#15803d', // green dark
]

// ---------------------------------------------------------------------------
// Color picker component
// ---------------------------------------------------------------------------
function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 active:scale-95 ${
            value === color ? 'border-gray-700 scale-110 ring-2 ring-offset-1 ring-gray-400' : 'border-transparent'
          }`}
          style={{ backgroundColor: color }}
          aria-label={`Cor ${color}`}
          aria-pressed={value === color}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline editable row
// ---------------------------------------------------------------------------
function CategoryRow({
  category,
  onUpdate,
  onDelete,
  isDeleting,
}: {
  category: Category
  onUpdate: (id: string, name: string, color: string | null) => Promise<void>
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(category.name)
  const [color, setColor] = useState<string | null>(category.color)
  const [saving, setSaving] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) { setEditing(false); setValue(category.name); return }
    setSaving(true)
    try {
      await onUpdate(category.id, trimmed, color)
      setEditing(false)
      setShowPalette(false)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(category.name)
    setColor(category.color)
    setEditing(false)
    setShowPalette(false)
  }

  const dotColor = category.color ?? '#9ca3af'

  return (
    <li className="flex flex-col px-4 py-3 hover:bg-gray-50/50 transition group">
      <div className="flex items-center gap-2">
        {/* Color dot */}
        {editing ? (
          <button
            type="button"
            onClick={() => setShowPalette((p) => !p)}
            className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-white shadow ring-1 ring-gray-200 hover:ring-gray-400 transition"
            style={{ backgroundColor: color ?? '#9ca3af' }}
            title="Escolher cor"
            aria-label="Escolher cor"
          />
        ) : (
          <div
            className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: dotColor }}
          />
        )}

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
              onClick={() => { setEditing(true); setShowPalette(false) }}
              className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500 transition"
              title="Editar">
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
      </div>

      {/* Inline palette when editing */}
      {editing && showPalette && (
        <div className="ml-7 mt-2 p-2 rounded-xl border border-gray-100 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Escolha uma cor</p>
          <ColorPicker value={color} onChange={(c) => { setColor(c); setShowPalette(false) }} />
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CategoriesPage() {
  const [name, setName] = useState('')
  const [newColor, setNewColor] = useState<string | null>('#6b7280')
  const [showNewPalette, setShowNewPalette] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()

  const updateMutation = useMutation<Category, AxiosError<{ code: string; message: string }>, { id: string; name: string; color: string | null }>({
    mutationFn: async ({ id, name, color }) => {
      const { data } = await api.put(`/api/categories/${id}`, { name, color })
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
        setActionError('Erro ao atualizar a categoria.')
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
      { name: trimmed, color: newColor },
      {
        onSuccess: () => { setName(''); setNewColor('#6b7280'); setShowNewPalette(false); setValidationError(null) },
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
            {(categories ?? []).length} categorias · clique no lápis para editar nome e cor
          </p>
        </div>
      </div>

      {/* Formulário de criação */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nova categoria</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start gap-2">
            {/* Color dot button */}
            <button
              type="button"
              onClick={() => setShowNewPalette((p) => !p)}
              className="mt-0.5 h-9 w-9 flex-shrink-0 rounded-xl border-2 border-gray-200 hover:border-gray-400 shadow-sm transition flex items-center justify-center"
              style={{ backgroundColor: newColor ?? '#9ca3af' }}
              title="Escolher cor"
              aria-label="Escolher cor da categoria"
            >
              {!newColor && <Palette className="h-4 w-4 text-white" />}
            </button>

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
          </div>

          {/* Color palette for new category */}
          {showNewPalette && (
            <div className="ml-11 p-3 rounded-xl border border-gray-100 bg-gray-50 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Escolha uma cor</p>
              <ColorPicker value={newColor} onChange={(c) => { setNewColor(c); setShowNewPalette(false) }} />
            </div>
          )}
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
                onUpdate={(id, newName, color) => updateMutation.mutateAsync({ id, name: newName, color })}
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
