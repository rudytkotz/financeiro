import { useState, useCallback } from 'react'
import { FileUpload } from '../components/FileUpload'
import { parseCsv, type CsvParseResult, type ParsedTransaction } from '../lib/parseCsv'
import { useImportCsv, type ImportCsvPayload } from '../hooks/useMutations'
import { AxiosError } from 'axios'
import { Trash2 } from 'lucide-react'

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
  _id: number
  _amountDisplay: string // controlled display value for the amount input
}

export default function ImportPage() {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [editableTransactions, setEditableTransactions] = useState<EditableTransaction[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [duplicateModal, setDuplicateModal] = useState<{ referenceMonth: string } | null>(null)

  const importCsv = useImportCsv()

  const buildPayload = (force: boolean): ImportCsvPayload => ({
    transactions: editableTransactions.map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      categoryId: null,
      dependentId: null,
      source: 'csv' as const,
      importId: null,
      portador: tx.portador ?? null,
      installmentCurrent: tx.installmentCurrent ?? null,
      installmentTotal: tx.installmentTotal ?? null,
    })),
    referenceMonth,
    force,
  })

  const handleFileAccepted = async (file: File) => {
    setFileError(null)
    setParseResult(null)
    setEditableTransactions([])
    setSuccessMessage(null)
    setIsLoading(true)
    try {
      const result = await parseCsv(file)
      setParseResult(result)
      setEditableTransactions(
        result.valid.map((tx, idx) => ({
          ...tx,
          _id: idx,
          _amountDisplay: formatCurrencyInput(tx.amount),
        }))
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

  // Generic field updater
  const updateField = useCallback(<K extends keyof EditableTransaction>(
    id: number,
    field: K,
    value: EditableTransaction[K]
  ) => {
    setEditableTransactions((prev) =>
      prev.map((tx) => (tx._id === id ? { ...tx, [field]: value } : tx))
    )
  }, [])

  // Commit amount from display string back to cents on blur
  const commitAmount = useCallback((id: number) => {
    setEditableTransactions((prev) =>
      prev.map((tx) => {
        if (tx._id !== id) return tx
        const cents = parseCurrencyInput(tx._amountDisplay)
        if (cents === null) return { ...tx, _amountDisplay: formatCurrencyInput(tx.amount) } // revert
        return { ...tx, amount: cents, _amountDisplay: formatCurrencyInput(cents) }
      })
    )
  }, [])

  // Commit installment string (e.g. "2/12") back to fields on blur
  const commitInstallment = useCallback((id: number, value: string) => {
    setEditableTransactions((prev) =>
      prev.map((tx) => {
        if (tx._id !== id) return tx
        const match = value.trim().match(/^(\d+)\/(\d+)$/)
        if (match) {
          return {
            ...tx,
            installment: value.trim(),
            installmentCurrent: parseInt(match[1], 10),
            installmentTotal: parseInt(match[2], 10),
          }
        }
        // Invalid format — keep as-is but clear parsed fields
        return { ...tx, installment: value.trim() || undefined, installmentCurrent: undefined, installmentTotal: undefined }
      })
    )
  }, [])

  const handleDeleteRow = useCallback((id: number) => {
    setEditableTransactions((prev) => prev.filter((tx) => tx._id !== id))
  }, [])

  const handleImport = async () => {
    if (editableTransactions.length === 0) return
    setIsSubmitting(true)
    setSuccessMessage(null)
    try {
      const payload = buildPayload(false)
      const result = await importCsv.mutateAsync(payload)
      setSuccessMessage(`Importação concluída! ${result.transactionCount} transação(ões) importada(s).`)
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
      setSuccessMessage(`Importação concluída! ${result.transactionCount} transação(ões) importada(s).`)
      setParseResult(null)
      setEditableTransactions([])
    } catch {
      setFileError('Ocorreu um erro ao importar as transações. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasValidTransactions = editableTransactions.length > 0
  const allInvalid = parseResult !== null && parseResult.valid.length === 0 && parseResult.invalidCount > 0

  const inputBase =
    'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm transition ' +
    'hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'

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
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {fileError}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Processando arquivo...</p>}

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700" role="alert">
          {successMessage}
        </div>
      )}

      {allInvalid && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800" role="alert">
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
          <p className="text-sm text-gray-500">
            {editableTransactions.length} transação(ões) para importar. Edite diretamente na tabela antes de importar.
          </p>

          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Data</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Descrição</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Portador</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Valor (R$)</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">Parcela</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editableTransactions.map((tx, i) => {
                  const isReembolso = tx.amount < 0
                  return (
                    <tr key={tx._id} className={i % 2 === 1 ? 'bg-gray-50/40' : ''}>
                      {/* Data */}
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={tx.date}
                          onChange={(e) => updateField(tx._id, 'date', e.target.value)}
                          className={inputBase}
                        />
                      </td>

                      {/* Descrição */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={tx.description}
                          onChange={(e) => updateField(tx._id, 'description', e.target.value)}
                          className={inputBase}
                        />
                      </td>

                      {/* Portador */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={tx.portador ?? ''}
                          onChange={(e) => updateField(tx._id, 'portador', e.target.value || undefined)}
                          placeholder="—"
                          className={inputBase}
                        />
                      </td>

                      {/* Valor */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tx._amountDisplay}
                          onChange={(e) => updateField(tx._id, '_amountDisplay', e.target.value)}
                          onBlur={() => commitAmount(tx._id)}
                          placeholder="0,00"
                          className={
                            inputBase +
                            ' text-right font-medium ' +
                            (isReembolso ? 'text-emerald-600' : 'text-gray-800')
                          }
                        />
                        {isReembolso && (
                          <span className="block text-right text-[9px] font-bold uppercase tracking-wider text-emerald-500 mt-0.5 pr-2">
                            Reembolso
                          </span>
                        )}
                      </td>

                      {/* Parcela */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={tx.installment ?? ''}
                          onChange={(e) => updateField(tx._id, 'installment', e.target.value || undefined)}
                          onBlur={(e) => commitInstallment(tx._id, e.target.value)}
                          placeholder="1/12"
                          className={inputBase + ' text-center w-20'}
                        />
                      </td>

                      {/* Remover */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(tx._id)}
                          className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                          title="Remover linha"
                          aria-label={`Remover ${tx.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setParseResult(null); setEditableTransactions([]) }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Importando...' : `Importar ${editableTransactions.length} transação(ões)`}
            </button>
          </div>
        </>
      )}

      {/* Modal duplicidade */}
      {duplicateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-modal-title"
        >
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="duplicate-modal-title" className="text-lg font-semibold text-gray-900">
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
                onClick={() => setDuplicateModal(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
