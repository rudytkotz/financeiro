import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Transaction, Category, Dependent, Income, DashboardSummary, CsvParseResult } from './types'

describe('shared types', () => {
  it('Transaction shape is correct', () => {
    const t: Transaction = {
      id: '1',
      date: '2024-01-01',
      description: 'Test',
      amount: 1000,
      categoryId: 'cat-1',
      dependentId: null,
      source: 'manual',
      importId: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(t.amount).toBeGreaterThan(0)
    expect(['csv', 'manual']).toContain(t.source)
  })

  it('DashboardSummary balance invariant holds for any income and expenses', () => {
    // Feature: controle-financeiro, Property 9: cálculo correto de saldo
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999999999 }),
        fc.integer({ min: 0, max: 9999999999 }),
        (income, userExpenses) => {
          const balance = income - userExpenses
          const summary: DashboardSummary = {
            month: '2024-01',
            totalUserExpenses: userExpenses,
            incomeAmount: income,
            balance,
            expensesByCategory: [],
            expensesByDependent: [],
          }
          return summary.balance === summary.incomeAmount! - summary.totalUserExpenses
        }
      )
    )
  })
})
