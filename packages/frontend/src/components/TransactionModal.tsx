import { useEffect, useRef, useState, useMemo } from 'react'
import type { Transaction, Category, Dependent, Account } from '@financeiro/shared'
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Smartphone, Wallet, Banknote, TrendingUp, TrendingDown, Paperclip, X as XIcon, Tag } from 'lucide-react'

type OperationType = 'despesa' | 'reembolso'
type TxKind = 'despesa' | 'receita'

const PAYMENT_METHODS = [
  { value: 'credito',   label: 'Crédito',   icon: CreditCard },
  { value: 'debito',    label: 'Débito',     icon: Wallet },
  { value: 'pix',       label: 'Pix',        icon: Smartphone },
  { value: 'dinheiro',  label: 'Dinheiro',   icon: Banknote },
  { value: 'outros',    label: 'Outros',     icon: Wallet },
] as const

export interface TransactionModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    date: string
    description: string
    amount: number
    categoryId: string
    dependentId: string | null
    accountId: string | null
    kind: TxKind
    operationType: OperationType
    installmentTotal: number
    paymentMethod: string
    tags: string | null
    attachmentUrl: string | null
    attachmentName: string | null
  }) => Promise<void>
  categories: Category[]
  dependents?: Dependent[]
  accounts?: Account[]
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
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',')
}

function brlToCents(value: string): number | null {
  const cleaned = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace('-', '')
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
  dependents = [],
  accounts = [],
  transaction,
}: TransactionModalProps) {
  const isEdit = !!transaction
  const overlayRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [dependentId, setDependentId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [kind, setKind] = useState<TxKind>('despesa')
  const [operationType, setOperationType] = useState<OperationType>('despesa')
  const [paymentMethod, setPaymentMethod] = useState('credito')
  const [installmentTotal, setInstallmentTotal] = useState(1)
  const [tags, setTags] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Dependente principal — usado como default ao abrir o modal para nova transação
  const mainDependent = useMemo(() => dependents.find((d) => d.isMain), [dependents])

  // Contas separadas por tipo para agrupar o seletor (cartões x contas)
  const cardAccounts = useMemo(() => accounts.filter((a) => a.type === 'cartao'), [accounts])
  const nonCardAccounts = useMemo(() => accounts.filter((a) => a.type !== 'cartao'), [accounts])
  const accountName = useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a.name]))
    return (id: string) => byId.get(id) ?? ''
  }, [accounts])

  // Initialize form when opening or when transaction changes
  useEffect(() => {
    if (open) {
      if (transaction) {
        setDate(transaction.date)
        setDescription(transaction.description)
        setAmountDisplay(centsToBrl(transaction.amount))
        setCategoryId(transaction.categoryId ?? '')
        setDependentId(transaction.dependentId ?? '')
        setAccountId(transaction.accountId ?? '')
        setKind(transaction.kind === 'receita' ? 'receita' : 'despesa')
        setOperationType(detectOperationType(transaction.amount))
        setPaymentMethod((transaction as any).paymentMethod ?? 'credito')
        setInstallmentTotal(transaction.installmentTotal ?? 1)
        setTags(transaction.tags ?? '')
        setAttachmentUrl(transaction.attachmentUrl ?? null)
        setAttachmentName(transaction.attachmentName ?? null)
      } else {
        setDate('')
        setDescription('')
        setAmountDisplay('')
        setCategoryId('')
        // Pré-selecionar o dependente principal se existir
        setDependentId(mainDependent?.id ?? '')
        setAccountId('')
        setKind('despesa')
        setOperationType('despesa')
        setPaymentMethod('credito')
        setInstallmentTotal(1)
        setTags('')
        setAttachmentUrl(null)
        setAttachmentName(null)
      }
      setErrors({})
      setServerError('')
    }
  }, [open, transaction, mainDependent])

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
    if (!date) errs.date = 'Data é obrigatória'
    if (!description.trim()) errs.description = 'Descrição é obrigatória'
    else if (description.trim().length > 255) errs.description = 'Descrição deve ter no máximo 255 caracteres'
    const cents = brlToCents(amountDisplay)
    if (cents === null) errs.amount = 'Valor mínimo: R$ 0,01'
    else if (cents > 999999999) errs.amount = 'Valor máximo: R$ 9.999.999,99'
    if (!categoryId) errs.categoryId = 'Categoria é obrigatória'
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
        dependentId: dependentId || null,
        accountId: accountId || null,
        kind,
        operationType,
        installmentTotal,
        paymentMethod,
        tags: tags.trim() || null,
        attachmentUrl,
        attachmentName,
      })
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar transação. Tente novamente.'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open) return null

  const isReembolso = operationType === 'reembolso'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id="transaction-modal-title" className="mb-4 text-lg font-semibold">
          {isEdit ? 'Editar Transação' : 'Nova Transação'}
        </h2>

        {serverError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Despesa x Receita */}
          <div>
            <span className="mb-1.5 block text-sm font-medium">Natureza</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Natureza da transação">
              <button
                type="button"
                onClick={() => setKind('despesa')}
                aria-pressed={kind === 'despesa'}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  kind === 'despesa'
                    ? 'border-red-400 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Despesa
              </button>
              <button
                type="button"
                onClick={() => { setKind('receita'); setOperationType('despesa') }}
                aria-pressed={kind === 'receita'}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  kind === 'receita'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Receita
              </button>
            </div>
          </div>

          {/* Tipo de Operação — só para despesas */}
          {kind === 'despesa' && (
          <div>
            <span className="mb-1.5 block text-sm font-medium">Tipo de operação</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de operação">
              <button
                type="button"
                onClick={() => setOperationType('despesa')}
                aria-pressed={!isReembolso}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
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
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
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
          )}

          {/* Data */}
          <div>
            <label htmlFor="tx-date" className="mb-1 block text-sm font-medium">Data</label>
            <input
              ref={firstInputRef}
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="tx-description" className="mb-1 block text-sm font-medium">Descrição</label>
            <input
              id="tx-description"
              type="text"
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado"
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
          </div>

          {/* Valor */}
          <div>
            <label htmlFor="tx-amount" className="mb-1 block text-sm font-medium">Valor (R$)</label>
            <div className="relative">
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
                className={`w-full rounded-xl border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                } ${isReembolso ? 'text-emerald-700' : 'text-gray-800'}`}
              />
            </div>
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
          </div>

          {/* Categoria */}
          <div>
            <label htmlFor="tx-category" className="mb-1 block text-sm font-medium">Categoria</label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.categoryId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Selecione...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>}
          </div>

          {/* Dependente */}
          {dependents.length > 0 && (
            <div>
              <label htmlFor="tx-dependent" className="mb-1 block text-sm font-medium">
                Dependente
                {mainDependent && !isEdit && (
                  <span className="ml-2 text-[10px] font-normal text-violet-500">
                    (padrão: {mainDependent.name})
                  </span>
                )}
              </label>
              <select
                id="tx-dependent"
                value={dependentId}
                onChange={(e) => setDependentId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nenhum (pessoal)</option>
                {dependents.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}{dep.isMain ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conta / cartão — integrado com a forma de pagamento.
              No crédito, sugerimos os cartões; nos demais, as contas. */}
          {accounts.length > 0 && (
            <div>
              <label htmlFor="tx-account" className="mb-1 block text-sm font-medium">
                {paymentMethod === 'credito' ? 'Cartão' : 'Conta'}
                <span className="ml-1.5 text-[10px] font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                id="tx-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nenhuma</option>
                {cardAccounts.length > 0 && (
                  <optgroup label="Cartões de crédito">
                    {cardAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}{acc.parentAccountId ? ` (${accountName(acc.parentAccountId)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {nonCardAccounts.length > 0 && (
                  <optgroup label="Contas e carteiras">
                    {nonCardAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {paymentMethod === 'credito' && cardAccounts.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Nenhum cartão cadastrado. Cadastre em Contas → Cartões para vincular.
                </p>
              )}
            </div>
          )}

          {/* Forma de Pagamento */}
          <div>
            <span className="mb-1.5 block text-sm font-medium">Forma de pagamento</span>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Forma de pagamento">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  aria-pressed={paymentMethod === value}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    paymentMethod === value
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tx-tags" className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Tag className="h-3.5 w-3.5 text-gray-400" /> Tags <span className="text-[10px] font-normal text-gray-400">(separe por vírgula)</span>
            </label>
            <input id="tx-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex: viagem, presente"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Anexo / comprovante */}
          <div>
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Paperclip className="h-3.5 w-3.5 text-gray-400" /> Comprovante <span className="text-[10px] font-normal text-gray-400">(imagem ou PDF)</span>
            </span>
            {attachmentUrl ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="truncate text-gray-600">{attachmentName ?? 'Anexo'}</span>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null) }} className="rounded p-1 text-gray-400 hover:text-red-500" aria-label="Remover anexo"><XIcon className="h-4 w-4" /></button>
              </div>
            ) : (
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 1_500_000) { setServerError('Anexo muito grande (máx 1,5 MB).'); return }
                  const reader = new FileReader()
                  reader.onload = () => { setAttachmentUrl(String(reader.result)); setAttachmentName(file.name) }
                  reader.readAsDataURL(file)
                }}
                className="w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20" />
            )}
          </div>

          {/* Parcelamento — apenas em criação */}
          {!isEdit && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">Parcelamento</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setInstallmentTotal(installmentTotal === 1 ? 2 : 1)}
                  aria-pressed={installmentTotal > 1}
                  className={`flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    installmentTotal > 1
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {installmentTotal > 1 ? 'Parcelado' : 'À vista'}
                </button>
                {installmentTotal > 1 && (
                  <select
                    value={installmentTotal}
                    onChange={(e) => setInstallmentTotal(Number(e.target.value))}
                    aria-label="Número de parcelas"
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.installmentTotal ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                        {amountDisplay
                          ? ` — R$ ${((brlToCents(amountDisplay) ?? 0) / n / 100).toFixed(2).replace('.', ',')}`
                          : ''}
                      </option>
                    ))}
                  </select>
                )}
                {installmentTotal === 1 && (
                  <span className="text-xs text-gray-400">Sem divisão em parcelas</span>
                )}
              </div>
              {errors.installmentTotal && <p className="mt-1 text-xs text-red-600">{errors.installmentTotal}</p>}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition ${
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
