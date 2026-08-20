import { useState, useCallback } from 'react'
import { FileUpload } from '../components/FileUpload'
import { parseCsv, type CsvParseResult, type ParsedTransaction } from '../lib/parseCsv'
import { useImportCsv, type ImportCsvPayload } from '../hooks/useMutations'
import { useCategories } from '../hooks/useCategories'
import { useDependents } from '../hooks/useDependents'
import { AxiosError } from 'axios'
import { Pencil, Trash2, Check, X } from 'lucide-react'

function formatCurrency(cents: number): string {
  const prefix = cents < 0 ? '-' : ''
  return prefix + (Math.abs(cents) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCurrencyInput(cents: number): string {
  const prefix = cents < 0 ? '-' : ''
  return prefix + (Math.abs(cents) / 100).toFixed(2).replace('.', ',')
}

function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/\s/g, '').replace(/R\$\s*/, '')
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const num = Number(normalized)
  if (isNaN(num) || num === 0) return null
  return Math.round(num * 100)
}

interface EditableTransaction extends ParsedTransaction {
  _id: number // internal key for react
}

export default function ImportPage() {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [editableTransactions, setEditableTransactions] = useState<EditableTransaction[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  // Reference month (user-selected, defaults to current month)
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{
    date: string
    description: string
    amount: string
    portador: string
    installment: string
  }>({ date: '', description: '', amount: '', portador: '', installment: '' })

  // Import flow state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [duplicateModal, setDuplicateModal] = useState<{ referenceMonth: string } | null>(null)

  const importCsv = useImportCsv()
  const { data: categories } = useCategories()
  const { data: dependents } = useDependents()

  const getDefaultCategoryId = (): string => {
    if (!categories || categories.length === 0) return ''
    const outros = categories.find(
      (c) => c.name.toLowerCase() === 'outros' || c.isDefault
    )
    return outros?.id ?? categories[0].id
  }

  const buildPayload = (force: boolean): ImportCsvPayload => {
    const categoryId = getDefaultCategoryId()
    return {
      transactions: editableTransactions.map((tx) => ({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        categoryId,
        dependentId: null,
        source: 'csv' as const,
        importId: null,
        portador: tx.portador ?? null,
        installmentCurrent: tx.installmentCurrent ?? null,
        installmentTotal: tx.installmentTotal ?? null,
      })),
      referenceMonth,
      force,
    }
  }

  const handleFileAccepted = async (file: File) => {
    setFileError(null)
    setParseResult(null)
    setEditableTransactions([])
    setSuccessMessage(null)
    setEditingId(null)
    setIsLoading(true)
    try {
      const result = await parseCsv(file)
      setParseResult(result)
      setEditableTransactions(
        result.valid.map((tx, idx) => ({ ...tx, _id: idx }))
      )
    } catch {
      setFileError('Não foi possível processar o arquivo. Verifique se o arquivo está correto e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileError = (message: string) => {
    setFileError(message)
    setParseResult(null)
    setEditableTransactions([])
    setSuccessMessage(null)
  }

  // --- Editing handlers ---

  const handleStartEdit = useCallback((tx: EditableTransaction) => {
    setEditingId(tx._id)
    setEditForm({
      date: tx.date,
      description: tx.description,
      amount: formatCurrencyInput(tx.amount),
      portador: tx.portador ?? '',
      installment: tx.installment ?? '',
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingId === null) return

    const amount = parseCurrencyInput(editForm.amount)
    if (!amount) return
    if (!editForm.date || !editForm.description.trim()) return

    // Parse installment
    let installmentCurrent: number | undefined
    let installmentTotal: number | undefined
    let installmentStr: string | undefined
    if (editForm.installment.trim()) {
      const match = editForm.installment.trim().match(/^(\d+)\/(\d+)$/)
      if (match) {
        installmentCurrent = parseInt(match[1], 10)
        installmentTotal = parseInt(match[2], 10)
        installmentStr = editForm.installment.trim()
      }
    }

    setEditableTransactions((prev) =>
      prev.map((tx) =>
        tx._id === editingId
          ? {
              ...tx,
              date: editForm.date,
              description: editForm.description.trim(),
              amount,
              portador: editForm.portador.trim() || undefined,
              installment: installmentStr,
              installmentCurrent,
              installmentTotal,
            }
          : tx
      )
    )
    setEditingId(null)
  }, [editingId, editForm])

  const handleDeleteRow = useCallback((id: number) => {
    setEditableTransactions((prev) => prev.filter((tx) => tx._id !== id))
  }, [])

  // --- Import handlers ---

  const handleImport = async () => {
    if (editableTransactions.length === 0) return

    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      const payload = buildPayload(false)
      const result = await importCsv.mutateAsync(payload)
      setSuccessMessage(`Importação concluída com sucesso! ${result.transactionCount} transação(ões) importada(s).`)
      setParseResult(null)
      setEditableTransactions([])
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 409) {
        const data = error.response.data
        if (data?.isDuplicate && data?.referenceMonth) {
          setDuplicateModal({ referenceMonth: data.referenceMonth })
          return
        }
      }
      setFileError('Ocorreu um erro ao importar as transações. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDuplicate = async () => {
    setDuplicateModal(null)
    setIsSubmitting(true)

    try {
      const payload = buildPayload(true)
      const result = await importCsv.mutateAsync(payload)
      setSuccessMessage(`Importação concluída com sucesso! ${result.transactionCount} transação(ões) importada(s).`)
      setParseResult(null)
      setEditableTransactions([])
    } catch {
      setFileError('Ocorreu um erro ao importar as transações. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelDuplicate = () => {
    setDuplicateModal(null)
  }

  const hasValidTransactions = editableTransactions.length > 0
  const allInvalid =
    parseResult !== null &&
    parseResult.valid.length === 0 &&
    parseResult.invalidCount > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importar Fatura</h1>

      <FileUpload onFileAccepted={handleFileAccepted} onError={handleFileError} />

      <div className="flex items-center gap-3">
        <label htmlFor="reference-month" className="text-sm font-medium text-gray-700">
          Mês da fatura:
        </label>
        <input
          id="reference-month"
          type="month"
          value={referenceMonth}
          onChange={(e) => setReferenceMonth(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {fileError && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {fileError}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-gray-500">Processando arquivo...</p>
      )}

      {successMessage && (
        <div
          className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          role="alert"
        >
          {successMessage}
        </div>
      )}

      {allInvalid && (
        <div
          className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"
          role="alert"
        >
          Nenhuma transação válida encontrada no arquivo.
        </div>
      )}

      {parseResult && parseResult.invalidCount > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-yellow-800"
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            aria-expanded={errorsExpanded}
          >
            <span>{parseResult.invalidCount} linha(s) ignorada(s)</span>
            <span className="text-xs">{errorsExpanded ? '▲' : '▼'}</span>
          </button>

          {errorsExpanded && (
            <ul className="mt-3 space-y-1 text-xs text-yellow-700">
              {parseResult.invalidReasons.map((item, idx) => (
                <li key={idx}>
                  <span className="font-medium">Linha {item.line}:</span> {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasValidTransactions && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {editableTransactions.length} transação(ões) para importar.
              <span className="ml-2 text-xs text-gray-400">Clique no ícone de editar para alterar antes de importar.</span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Portador</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Valor (R$)</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Parcela</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editableTransactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    {editingId === tx._id ? (
                      <>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={editForm.portador}
                            onChange={(e) => setEditForm((f) => ({ ...f, portador: e.target.value }))}
                            placeholder="Nome do portador"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="0,00"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={editForm.installment}
                            onChange={(e) => setEditForm((f) => ({ ...f, installment: e.target.value }))}
                            placeholder="1/12"
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="rounded p-1 text-green-600 hover:bg-green-50"
                              title="Salvar"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded p-1 text-gray-500 hover:bg-gray-100"
                              title="Cancelar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-gray-700">{tx.date}</td>
                        <td className="px-4 py-2 text-gray-700">{tx.description}</td>
                        <td className="px-4 py-2 text-gray-700">{tx.portador ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-700">
                          {tx.installment ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tx)}
                              className="rounded p-1 text-blue-600 hover:bg-blue-50"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(tx._id)}
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setParseResult(null)
                setEditableTransactions([])
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isSubmitting || editingId !== null}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Importando...' : `Importar ${editableTransactions.length} transação(ões)`}
            </button>
          </div>
        </>
      )}

      {/* Modal de confirmação de duplicidade */}
      {duplicateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-modal-title"
        >
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2
              id="duplicate-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Importação duplicada
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Já existe uma importação para o mês{' '}
              <span className="font-medium">{duplicateModal.referenceMonth}</span>.
              Deseja substituir?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDuplicate}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
