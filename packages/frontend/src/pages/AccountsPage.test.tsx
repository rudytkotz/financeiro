import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AccountsPage from './AccountsPage'

const accounts = [
  {
    id: 'acc-1',
    name: 'Nubank',
    type: 'corrente',
    initialBalance: 1000,
    color: '#4f46e5',
    closingDay: null,
    dueDay: null,
    creditLimit: null,
    parentAccountId: null,
    dependentId: null,
    archived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    currentBalance: 2000,
  },
  {
    id: 'card-1',
    name: 'Cartão Nubank',
    type: 'cartao',
    initialBalance: 0,
    color: '#7c3aed',
    closingDay: 10,
    dueDay: 20,
    creditLimit: 5000,
    parentAccountId: null,
    dependentId: null,
    archived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    currentBalance: 0,
  },
]

const summaryList = [
  {
    accountId: 'acc-1',
    currentBalance: 2000,
    investedCurrent: 0,
    investmentCount: 0,
    transactionCount: 1,
    linkedCardCount: 0,
    cardUsageCurrent: 0,
    creditLimit: null,
    limitUsagePct: null,
  },
  {
    accountId: 'card-1',
    currentBalance: 0,
    investedCurrent: 0,
    investmentCount: 0,
    transactionCount: 0,
    linkedCardCount: 0,
    cardUsageCurrent: 1200,
    creditLimit: 5000,
    limitUsagePct: 24,
  },
]

const investments = [
  {
    id: 'inv-1',
    type: 'renda_variavel',
    ticker: 'PETR4',
    name: 'Petrobras',
    assetClass: 'acao',
    investedAmount: null,
    applicationDate: null,
    maturityDate: null,
    rateType: null,
    rateValue: null,
    accountId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

vi.mock('@/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: accounts, isLoading: false }),
  useCreateAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAccount: () => ({ mutate: vi.fn() }),
  useInvoice: () => ({
    data: {
      total: 1200,
      closingDate: '2024-02-10',
      dueDate: '2024-02-20',
      limitUsagePct: null,
      transactions: [],
    },
    isLoading: false,
  }),
  useAccountsSummary: () => ({ data: summaryList }),
}))

vi.mock('@/hooks/useDependents', () => ({
  useDependents: () => ({ data: [] }),
}))

vi.mock('@/hooks/useInvestments', () => ({
  useInvestments: () => ({ data: investments }),
  useUpdateRvInvestment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePortfolioSummary: () => ({
    data: {
      totalInvested: 5000,
      totalCurrent: 5200,
      totalProfitLoss: 200,
      totalProfitLossPct: 4,
      rendaVariavelTotal: 3000,
      rendaFixaTotal: 2000,
    },
  }),
}))

vi.mock('@/components/AccountModal', () => ({
  default: () => null,
  ACCOUNT_TYPES: [
    { value: 'corrente', label: 'Conta corrente', icon: 'Wallet' },
    { value: 'poupanca', label: 'Poupança', icon: 'PiggyBank' },
    { value: 'carteira', label: 'Carteira', icon: 'Wallet' },
    { value: 'cartao', label: 'Cartão', icon: 'CreditCard' },
    { value: 'investimento', label: 'Investimento', icon: 'TrendingUp' },
    { value: 'outro', label: 'Outro', icon: 'Banknote' },
  ],
}))

vi.mock('@/components/TransferModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDialog', () => ({ default: () => null }))

describe('AccountsPage', () => {
  it('soma o saldo em contas com o total investido no patrimônio', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('R$ 70,00')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 20,00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('R$ 50,00').length).toBeGreaterThan(0)
  })

  it('mostra o uso total do limite dos cartões na visão geral', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Uso: R\$ 12,00/i)).toBeInTheDocument()
    expect(screen.getByText(/Limite: R\$ 50,00/i)).toBeInTheDocument()
  })

  it('oferece ação para adicionar cartão vinculado a uma conta pai', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /adicionar cartão/i })).toBeInTheDocument()
  })

  it('exibe investimentos sem conta vinculada na visão geral', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/investimentos sem conta/i)).toBeInTheDocument()
    expect(screen.getByText(/petrobras/i)).toBeInTheDocument()
  })

  it('permite vincular investimento órfão a uma conta existente', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /vincular/i })).toBeInTheDocument()
  })

  it('indica que o cartão não possui limite definido', () => {
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/sem limite definido/i)).toBeInTheDocument()
  })
})
