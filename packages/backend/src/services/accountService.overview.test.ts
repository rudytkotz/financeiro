import { describe, it, expect } from 'vitest'
import { buildAccountsOverviewSummary, validateAccountParentLink } from './accountService'

describe('validateAccountParentLink', () => {
  it('rejects parent links for non-card accounts and self-references', () => {
    expect(() => validateAccountParentLink('corrente', 'account-1')).toThrow('Cartões só podem ter conta pai.')
    expect(() => validateAccountParentLink('cartao', 'account-1', 'account-1')).toThrow('Uma conta não pode ser vinculada a si mesma.')
  })
})

describe('buildAccountsOverviewSummary', () => {
  it('sums cash, investments and card usage without counting cards as liquid cash', () => {
    const accounts = [
      { id: 'c-1', type: 'corrente', initialBalance: 50000, archived: false },
      { id: 'c-2', type: 'poupanca', initialBalance: 20000, archived: false },
      { id: 'c-3', type: 'cartao', initialBalance: 0, archived: false, creditLimit: 4000 },
      { id: 'c-4', type: 'investimento', initialBalance: 0, archived: false },
      { id: 'c-5', type: 'corrente', initialBalance: 99999, archived: true },
    ] as any

    const result = buildAccountsOverviewSummary({
      accounts,
      totalInvested: 30000,
      cardUsageByAccount: new Map([['c-3', 2000]]),
      linkedInvestmentCount: 2,
      orphanInvestmentCount: 1,
      counts: {
        total: 5,
        operational: 2,
        archived: 1,
        cartoes: 1,
        investimentos: 1,
      },
    })

    expect(result.operationalBalance).toBe(70000)
    expect(result.totalInvested).toBe(30000)
    expect(result.patrimonio).toBe(100000)
    expect(result.cards.count).toBe(1)
    expect(result.cards.totalLimit).toBe(4000)
    expect(result.cards.totalUsage).toBe(2000)
    expect(result.investments.linked).toBe(2)
    expect(result.investments.orphans).toBe(1)
  })
})
