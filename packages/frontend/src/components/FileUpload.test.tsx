import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileUpload } from './FileUpload'

function createFile(name: string, size: number, type = 'text/csv'): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('FileUpload', () => {
  it('renders upload area with instructions', () => {
    render(<FileUpload onFileAccepted={vi.fn()} onError={vi.fn()} />)
    expect(screen.getByText(/Clique ou arraste um arquivo CSV aqui/)).toBeInTheDocument()
    expect(screen.getByText(/Tamanho máximo: 10 MB/)).toBeInTheDocument()
  })

  it('accepts a valid .csv file and displays its name', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const file = createFile('fatura.csv', 1024)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFileAccepted).toHaveBeenCalledWith(file)
    expect(onError).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-name')).toHaveTextContent('fatura.csv')
  })

  it('rejects a file with non-.csv extension and shows error', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const file = createFile('document.pdf', 1024, 'application/pdf')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(onError).toHaveBeenCalledWith('Formato inválido. Por favor, envie um arquivo CSV.')
    expect(onFileAccepted).not.toHaveBeenCalled()
    expect(screen.queryByTestId('file-name')).not.toBeInTheDocument()
  })

  it('rejects a file larger than 10 MB and shows error', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const largeFile = createFile('big.csv', 11 * 1024 * 1024)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [largeFile] } })

    expect(onError).toHaveBeenCalledWith('O arquivo excede o tamanho máximo permitido de 10 MB.')
    expect(onFileAccepted).not.toHaveBeenCalled()
    expect(screen.queryByTestId('file-name')).not.toBeInTheDocument()
  })

  it('accepts a file exactly 10 MB', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const file = createFile('exact.csv', 10 * 1024 * 1024)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFileAccepted).toHaveBeenCalledWith(file)
    expect(onError).not.toHaveBeenCalled()
    expect(screen.getByTestId('file-name')).toHaveTextContent('exact.csv')
  })

  it('rejects .CSV (uppercase extension) correctly as valid', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const file = createFile('FATURA.CSV', 512)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(onFileAccepted).toHaveBeenCalledWith(file)
    expect(onError).not.toHaveBeenCalled()
  })

  it('handles file drop correctly', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = createFile('dropped.csv', 2048)

    fireEvent.dragOver(dropArea)
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [file] },
    })

    expect(onFileAccepted).toHaveBeenCalledWith(file)
    expect(screen.getByTestId('file-name')).toHaveTextContent('dropped.csv')
  })

  it('rejects dropped file with wrong extension', () => {
    const onFileAccepted = vi.fn()
    const onError = vi.fn()
    render(<FileUpload onFileAccepted={onFileAccepted} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = createFile('data.xlsx', 2048)

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [file] },
    })

    expect(onError).toHaveBeenCalledWith('Formato inválido. Por favor, envie um arquivo CSV.')
    expect(onFileAccepted).not.toHaveBeenCalled()
  })
})
