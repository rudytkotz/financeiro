import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    strings,
    values,
    sql: strings.join(''),
  }))
  const mockEq = vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left, right }))
  const mockAnd = vi.fn((...parts: unknown[]) => ({ type: 'and', parts }))

  return { mockSelect, mockSql, mockEq, mockAnd }
})

vi.mock('../db/index.js', () => ({
  db: { select: mocks.mockSelect },
}))

vi.mock('../db/schema.js', () => ({
  accounts: {
    id: 'accounts.id',
    userId: 'accounts.user_id',
    type: 'accounts.type',
    initialBalance: 'accounts.initial_balance',
    archived: 'accounts.archived',
    creditLimit: 'accounts.credit_limit',
    parentAccountId: 'accounts.parent_account_id',
    name: 'accounts.name',
  },
  transactions: {
    accountId: 'transactions.account_id',
    userId: 'transactions.user_id',
    amount: 'transactions.amount',
    deletedAt: 'transactions.deleted_at',
  },
  investments: {
    accountId: 'investments.account_id',
    userId: 'investments.user_id',
    type: 'investments.type',
    investedAmount: 'investments.invested_amount',
  },
}))

vi.mock('../lib/ownership.js', () => ({
  assertAccountOwnership: vi.fn(),
  assertDependentOwnership: vi.fn(),
}))

vi.mock('../lib/errors.js', () => ({
  makeError: (status: number, code: string, message: string) => ({ statusCode: status, code, message }),
}))

vi.mock('./investmentService.js', () => ({
  getPortfolioSummary: vi.fn().mockResolvedValue({ totalInvested: 0 }),
  getRvPositions: vi.fn().mockResolvedValue([]),
}))

vi.mock('drizzle-orm', () => ({
  eq: mocks.mockEq,
  and: mocks.mockAnd,
  sql: mocks.mockSql,
}))

import { listAccounts } from './accountService'

describe('listAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignora transações apagadas da soma do saldo atual', async () => {
    const accountRows = [{
      id: 'acc-1',
      name: 'Conta',
      type: 'corrente',
      initialBalance: 1000,
      archived: false,
      userId: 'user-1',
      creditLimit: null,
      parentAccountId: null,
    }]

    mocks.mockSelect.mockImplementation((selection: Record<string, unknown> | undefined) => {
      if (!selection) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue(accountRows),
            })),
          })),
        }
      }

      if ('id' in selection && 'type' in selection && 'initialBalance' in selection) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue(accountRows),
            })),
          })),
        }
      }

      if ('accountId' in selection && 'total' in selection && !('count' in selection)) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              groupBy: vi.fn().mockResolvedValue([{ accountId: 'acc-1', total: '500' }]),
            })),
          })),
        }
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      }
    })

    const [result] = await listAccounts('user-1')

    expect(result.currentBalance).toBe(500)
    expect(mocks.mockAnd).toHaveBeenCalled()
    expect(mocks.mockSql).toHaveBeenCalled()
  })
})
