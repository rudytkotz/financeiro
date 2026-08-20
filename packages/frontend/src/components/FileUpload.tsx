import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

export interface FileUploadProps {
  /** Called when a valid file is selected */
  onFileAccepted: (file: File) => void
  /** Called when a validation error occurs */
  onError: (message: string) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * File upload component with client-side validation.
 * Accepts only .csv files up to 10 MB.
 */
export function FileUpload({ onFileAccepted, onError }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndAccept = useCallback(
    (file: File) => {
      // Validate extension
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setFileName(null)
        onError('Formato inválido. Por favor, envie um arquivo CSV.')
        return
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setFileName(null)
        onError('O arquivo excede o tamanho máximo permitido de 10 MB.')
        return
      }

      setFileName(file.name)
      onFileAccepted(file)
    },
    [onFileAccepted, onError]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        validateAndAccept(file)
      }
      // Reset input so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    [validateAndAccept]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        validateAndAccept(file)
      }
    },
    [validateAndAccept]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Área de upload de arquivo CSV"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
        isDragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 bg-background'
      }`}
    >
      <Upload className="h-10 w-10 text-gray-400" />
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">
          Clique ou arraste um arquivo CSV aqui
        </p>
        <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 10 MB</p>
      </div>

      {fileName && (
        <p className="text-sm text-green-700 font-medium mt-2" data-testid="file-name">
          {fileName}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
