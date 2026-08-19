import { useState } from 'react'
import { FileUpload } from '../components/FileUpload'
import { parseCsv, type CsvParseResult } from '../lib/parseCsv'
import { useImportCsv, type ImportCsvPayload } from '../hooks/useMutations'
import { useCategories } from '../hooks/useCategories'
import { AxiosError } from 'axios'

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ImportPage() {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  // Import flow state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [duplicateModal, setDuplicateModal] = useState<{ referenceMonth: string } | null>(null)

  const importCsv = useImportCsv()
  const { data: categories } = useCategories()

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
      transactions: parseResult!.valid.map((tx) => ({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        categoryId,
        dependentId: null,
        source: 'csv' as const,
        importId: null,
      })),
      force,
    }
  }

  const handleFileAccepted = async (file: File) => {
    setFileError(null)
    setParseResult(null)
    setSuccessMessage(null)
    setIsLoading(true)
    try {
      const result = await parseCsv(file)
      setParseResult(result)
    } catch {
      setFileError('Não foi possível processar o arquivo. Verifique se o arquivo está correto e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileError = (message: string) => {
    setFileError(message)
    setParseResult(null)
    setSuccessMessage(null)
  }

  const handleImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return

    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      const payload = buildPayload(false)
      const result = await importCsv.mutateAsync(payload)
      setSuccessMessage(`Importação concluída com sucesso! ${result.transactionCount} transação(ões) importada(s).`)
      setParseResult(null)
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
    } catch {
      setFileError('Ocorreu um erro ao importar as transações. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelDuplicate = () => {
    setDuplicateModal(null)
  }

  const hasValidTransactions = parseResult !== null && parseResult.valid.length > 0
  const allInvalid =
    parseResult !== null &&
    parseResult.valid.length === 0 &&
    parseResult.invalidCount > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importar Fatura</h1>

      <FileUpload onFileAccepted={handleFileAccepted} onError={handleFileError} />

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
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Descrição</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Valor (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parseResult!.valid.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{tx.date}</td>
                    <td className="px-4 py-2 text-gray-700">{tx.description}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Importando...' : 'Importar'}
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
