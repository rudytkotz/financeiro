import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountModal from './AccountModal'

describe('AccountModal', () => {
  it('shows the backend validation message instead of a generic error', async () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { message: 'Uma conta não pode ser vinculada a si mesma.' } },
    })

    render(
      <AccountModal
        account={null}
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        saving={false}
        accounts={[]}
        dependents={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank, Carteira...'), {
      target: { value: 'Conta corrente' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => {
      expect(screen.getByText('Uma conta não pode ser vinculada a si mesma.')).toBeInTheDocument()
    })
  })

  it('shows the validation message when the submit throws a plain Error object', async () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Uma conta não pode ser vinculada a si mesma.'))

    render(
      <AccountModal
        account={null}
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        saving={false}
        accounts={[]}
        dependents={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank, Carteira...'), {
      target: { value: 'Conta corrente' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() => {
      expect(screen.getByText('Uma conta não pode ser vinculada a si mesma.')).toBeInTheDocument()
    })
  })

  it('clears the parent account selection when the type stops being a card', () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <AccountModal
        account={null}
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        saving={false}
        accounts={[
          { id: 'acc-1', name: 'Conta principal', type: 'corrente', initialBalance: 0, archived: false, userId: 'u-1', color: null, createdAt: '2024-01-01T00:00:00.000Z', parentAccountId: null, dependentId: null, closingDay: null, dueDay: null, creditLimit: null },
        ]}
        dependents={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /cartão de crédito/i }))
    fireEvent.change(screen.getByLabelText('Vinculado à conta'), { target: { value: 'acc-1' } })
    fireEvent.click(screen.getByRole('button', { name: /conta corrente/i }))

    expect(screen.queryByLabelText('Vinculado à conta')).not.toBeInTheDocument()
  })
})
