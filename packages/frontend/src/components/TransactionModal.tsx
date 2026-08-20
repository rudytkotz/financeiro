import { useEffect, useRef, useState } from 'react'
import type { Transaction, Category } from '@financeiro/shared'

export interface TransactionModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { date: string; description: string; amount: number; categoryId: string }) => Promise<void>
  categories: Category[]
  transaction?: Transaction | null
}

interface FormErrors {
  date?: string
  description?: string
  amount?: string
  categoryId?: string
}

function centsToBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function brlToCents(value: string): number | null {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

export default function TransactionModal({
  open,
  onClose,
  onSubmit,
  categories,
  transaction,
}: TransactionModalProps) {
  const isEdit = !!transaction
  const overlayRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Initialize form when opening or when transaction changes
  useEffect(() => {
    if (open) {
      if (transaction) {
        setDate(transaction.date)
        setDescription(transaction.description)
        setAmountDisplay(centsToBrl(transaction.amount))
        setCategoryId(transaction.categoryId ?? '')
      } else {
        setDate('')
        setDescription('')
        setAmountDisplay('')
        setCategoryId('')
      }
      setErrors({})
      setServerError('')
    }
  }, [open, transaction])

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function validate(): FormErrors {
    const errs: FormErrors = {}

    if (!date) {
      errs.date = 'Data é obrigatória'
    }

    if (!description.trim()) {
      errs.description = 'Descrição é obrigatória'
    } else if (description.trim().length > 255) {
      errs.description = 'Descrição deve ter no máximo 255 caracteres'
    }

    const cents = brlToCents(amountDisplay)
    if (cents === null || cents < 1) {
      errs.amount = 'Valor mínimo: R$ 0,01'
    } else if (cents > 999999999) {
      errs.amount = 'Valor máximo: R$ 9.999.999,99'
    }

    if (!categoryId) {
      errs.categoryId = 'Categoria é obrigatória'
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setServerError('')
    setSubmitting(true)

    const cents = brlToCents(amountDisplay)!

    try {
      await onSubmit({
        date,
        description: description.trim(),
        amount: cents,
        categoryId,
      })
      onClose()
    } catch (err: unknown) {
      // Keep form data after persistence error
      const message = err instanceof Error ? err.message : 'Erro ao salvar transação. Tente novamente.'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="transaction-modal-title" className="mb-4 text-lg font-semibold">
          {isEdit ? 'Editar Transação' : 'Nova Transação'}
        </h2>

        {serverError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Data */}
          <div className="mb-4">
            <label htmlFor="tx-date" className="mb-1 block text-sm font-medium">
              Data
            </label>
            <input
              ref={firstInputRef}
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
          </div>

          {/* Descrição */}
          <div className="mb-4">
            <label htmlFor="tx-description" className="mb-1 block text-sm font-medium">
              Descrição
            </label>
            <input
              id="tx-description"
              type="text"
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado"
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
          </div>

          {/* Valor */}
          <div className="mb-4">
            <label htmlFor="tx-amount" className="mb-1 block text-sm font-medium">
              Valor (R$)
            </label>
            <input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              value={amountDisplay}
              onChange={(e) => setAmountDisplay(e.target.value)}
              placeholder="0,01"
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
          </div>

          {/* Categoria */}
          <div className="mb-6">
            <label htmlFor="tx-category" className="mb-1 block text-sm font-medium">
              Categoria
            </label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.categoryId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Selecione...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>}
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
