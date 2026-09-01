import { useEffect, useRef, useState } from 'react'
import type { Transaction, Category } from '@financeiro/shared'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

type OperationType = 'despesa' | 'reembolso'

export interface TransactionModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    date: string
    description: string
    amount: number
    categoryId: string
    operationType: OperationType
    installmentTotal: number
  }) => Promise<void>
  categories: Category[]
  transaction?: Transaction | null
}

interface FormErrors {
  date?: string
  description?: string
  amount?: string
  categoryId?: string
  installmentTotal?: string
}

function centsToBrl(cents: number): string {
  // Exibe sempre o valor absoluto — o tipo de operação controla o sinal
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',')
}

function brlToCents(value: string): number | null {
  const cleaned = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace('-', '')   // ignora sinal manual; o toggle controla isso
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num) || num <= 0) return null
  return Math.round(num * 100)
}

function detectOperationType(cents: number): OperationType {
  return cents < 0 ? 'reembolso' : 'despesa'
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
  const [operationType, setOperationType] = useState<OperationType>('despesa')
  const [installmentTotal, setInstallmentTotal] = useState(1)
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
        setOperationType(detectOperationType(transaction.amount))
        setInstallmentTotal(transaction.installmentTotal ?? 1)
      } else {
        setDate('')
        setDescription('')
        setAmountDisplay('')
        setCategoryId('')
        setOperationType('despesa')
        setInstallmentTotal(1)
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
    if (cents === null) {
      errs.amount = 'Valor mínimo: R$ 0,01'
    } else if (cents > 999999999) {
      errs.amount = 'Valor máximo: R$ 9.999.999,99'
    }

    if (!categoryId) {
      errs.categoryId = 'Categoria é obrigatória'
    }

    if (!Number.isInteger(installmentTotal) || installmentTotal < 1 || installmentTotal > 24) {
      errs.installmentTotal = 'Parcelas: entre 1 e 24'
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
        operationType,
        installmentTotal,
      })
      onClose()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao salvar transação. Tente novamente.'
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

  const isReembolso = operationType === 'reembolso'

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
          {/* Tipo de Operação */}
          <div className="mb-4">
            <span className="mb-1.5 block text-sm font-medium">Tipo de operação</span>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Tipo de operação"
            >
              <button
                type="button"
                onClick={() => setOperationType('despesa')}
                aria-pressed={!isReembolso}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  !isReembolso
                    ? 'border-red-400 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setOperationType('reembolso')}
                aria-pressed={isReembolso}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  isReembolso
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <ArrowUpCircle className="h-4 w-4" />
                Reembolso
              </button>
            </div>
          </div>

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
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Valor */}
          <div className="mb-4">
            <label htmlFor="tx-amount" className="mb-1 block text-sm font-medium">
              Valor (R$)
            </label>
            <div className="relative">
              {/* Indicador visual do sinal */}
              <span
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none ${
                  isReembolso ? 'text-emerald-600' : 'text-gray-400'
                }`}
                aria-hidden="true"
              >
                {isReembolso ? '−' : '+'}
              </span>
              <input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                value={amountDisplay}
                onChange={(e) => setAmountDisplay(e.target.value)}
                placeholder="0,01"
                className={`w-full rounded border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                } ${isReembolso ? 'text-emerald-700' : 'text-gray-800'}`}
              />
            </div>
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
          </div>

          {/* Categoria */}
          <div className="mb-4">
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
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>
            )}
          </div>

          {/* Parcelamento — disponível apenas em criação, não em edição */}
          {!isEdit && (
            <div className="mb-6">
              <span className="mb-1.5 block text-sm font-medium">Parcelamento</span>
              <div className="flex items-center gap-3">
                {/* Toggle à vista / parcelado */}
                <button
                  type="button"
                  onClick={() => setInstallmentTotal(installmentTotal === 1 ? 2 : 1)}
                  aria-pressed={installmentTotal > 1}
                  className={`flex-shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    installmentTotal > 1
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {installmentTotal > 1 ? 'Parcelado' : 'À vista'}
                </button>

                {/* Select de número de parcelas */}
                {installmentTotal > 1 && (
                  <select
                    value={installmentTotal}
                    onChange={(e) => setInstallmentTotal(Number(e.target.value))}
                    aria-label="Número de parcelas"
                    className={`flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.installmentTotal ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                        {amountDisplay
                          ? ` — R$ ${((brlToCents(amountDisplay) ?? 0) / n / 100)
                              .toFixed(2)
                              .replace('.', ',')}`
                          : ''}
                      </option>
                    ))}
                  </select>
                )}

                {installmentTotal === 1 && (
                  <span className="text-xs text-gray-400">Sem divisão em parcelas</span>
                )}
              </div>
              {errors.installmentTotal && (
                <p className="mt-1 text-xs text-red-600">{errors.installmentTotal}</p>
              )}
            </div>
          )}

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
              className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition ${
                isReembolso
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
            >
              {submitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
