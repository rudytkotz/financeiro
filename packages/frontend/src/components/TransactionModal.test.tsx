import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TransactionModal from './TransactionModal'
import type { Category, Transaction } from '@financeiro/shared'

const categories: Category[] = [
  { id: 'cat-1', name: 'Alimentação', isDefault: true },
  { id: 'cat-2', name: 'Transporte', isDefault: false },
]

const sampleTransaction: Transaction = {
  id: 'tx-1',
  date: '2024-03-15',
  description: 'Supermercado ABC',
  amount: 15000, // R$ 150,00
  categoryId: 'cat-1',
  dependentId: null,
  source: 'manual',
  importId: null,
  createdAt: '2024-03-15T10:00:00Z',
  updatedAt: '2024-03-15T10:00:00Z',
}

describe('TransactionModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    categories,
    transaction: null,
  }

  it('does not render when closed', () => {
    render(<TransactionModal {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders create mode title', () => {
    render(<TransactionModal {...defaultProps} />)
    expect(screen.getByText('Nova Transação')).toBeInTheDocument()
  })

  it('renders edit mode title with prefilled values', () => {
    render(<TransactionModal {...defaultProps} transaction={sampleTransaction} />)
    expect(screen.getByText('Editar Transação')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-03-15')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Supermercado ABC')).toBeInTheDocument()
    expect(screen.getByDisplayValue('150,00')).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<TransactionModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Criar'))

    await waitFor(() => {
      expect(screen.getByText('Data é obrigatória')).toBeInTheDocument()
      expect(screen.getByText('Descrição é obrigatória')).toBeInTheDocument()
      expect(screen.getByText('Valor mínimo: R$ 0,01')).toBeInTheDocument()
      expect(screen.getByText('Categoria é obrigatória')).toBeInTheDocument()
    })
  })

  it('shows error for description over 255 chars', async () => {
    render(<TransactionModal {...defaultProps} />)

    const descInput = screen.getByLabelText('Descrição')
    fireEvent.change(descInput, { target: { value: 'a'.repeat(256) } })
    // Fill other fields to isolate description error
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } })

    fireEvent.click(screen.getByText('Criar'))

    await waitFor(() => {
      expect(screen.getByText('Descrição deve ter no máximo 255 caracteres')).toBeInTheDocument()
    })
  })

  it('shows error for amount above maximum', async () => {
    render(<TransactionModal {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10000000,00' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } })

    fireEvent.click(screen.getByText('Criar'))

    await waitFor(() => {
      expect(screen.getByText('Valor máximo: R$ 9.999.999,99')).toBeInTheDocument()
    })
  })

  it('submits valid form with amount converted to cents', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<TransactionModal {...defaultProps} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-06-01' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Almoço' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '25,50' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } })

    fireEvent.click(screen.getByText('Criar'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        date: '2024-06-01',
        description: 'Almoço',
        amount: 2550,
        categoryId: 'cat-1',
      })
    })
  })

  it('keeps form data after server error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Erro de rede'))
    render(<TransactionModal {...defaultProps} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-06-01' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Almoço' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '25,50' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } })

    fireEvent.click(screen.getByText('Criar'))

    await waitFor(() => {
      expect(screen.getByText('Erro de rede')).toBeInTheDocument()
    })

    // Form values should still be present
    expect(screen.getByDisplayValue('2024-06-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Almoço')).toBeInTheDocument()
    expect(screen.getByDisplayValue('25,50')).toBeInTheDocument()
  })

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<TransactionModal {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking overlay', () => {
    const onClose = vi.fn()
    render(<TransactionModal {...defaultProps} onClose={onClose} />)

    const overlay = screen.getByRole('dialog')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('has proper accessibility attributes', () => {
    render(<TransactionModal {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'transaction-modal-title')
  })
})
