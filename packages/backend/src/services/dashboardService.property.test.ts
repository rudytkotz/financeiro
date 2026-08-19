// Feature: controle-financeiro, Property 9: cálculo correto de saldo
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionRecord {
  id: string
  date: string          // YYYY-MM-DD
  description: string
  amount: number        // centavos (positive integer)
  categoryId: string
  dependentId: string | null
  source: 'csv' | 'manual'
}

// ---------------------------------------------------------------------------
// Pure balance logic (replicates dashboardService calculation)
// ---------------------------------------------------------------------------

/**
 * Calculates the dashboard balance given an income amount and a set of transactions.
 *
 * Rules:
 * - If incomeAmount is null (no income registered), balance is null
 * - Otherwise, balance = incomeAmount - sum of user expenses
 * - User expenses = transactions where dependentId === null
 * - Transactions with dependentId !== null are NOT counted toward user expenses
 */
function calculateBalance(
  incomeAmount: number | null,
  transactions: TransactionRecord[]
): number | null {
  if (incomeAmount === null) {
    return null
  }

  const totalUserExpenses = transactions
    .filter((t) => t.dependentId === null)
    .reduce((sum, t) => sum + t.amount, 0)

  return incomeAmount - totalUserExpenses
}

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

/** Generate a valid date string in YYYY-MM-DD format */
const dateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

/** Generate a category ID from a small pool */
const categoryIdArb = fc.constantFrom('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5')

/** Generate a dependent ID (non-null) or null */
const dependentIdArb = fc.option(fc.uuid(), { nil: null })

/** Generate a single transaction record */
const transactionArb = fc.record({
  id: fc.uuid(),
  date: dateArb,
  description: fc.string({ minLength: 1, maxLength: 50 }),
  amount: fc.integer({ min: 1, max: 999999999 }),
  categoryId: categoryIdArb,
  dependentId: dependentIdArb,
  source: fc.constantFrom('csv' as const, 'manual' as const),
})

/** Generate a list of transactions (0 to 50 items) */
const transactionsListArb = fc.array(transactionArb, { minLength: 0, maxLength: 50 })

/** Generate a valid income amount (centavos, positive) */
const incomeAmountArb = fc.integer({ min: 1, max: 99999999999 })

/** Generate income: either a positive amount or null (no income registered) */
const incomeOrNullArb = fc.option(incomeAmountArb, { nil: null })

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 9: Saldo do painel é calculado corretamente para qualquer renda e gastos', () => {
  /**
   * **Validates: Requirements 6.1, 6.3, 7.1**
   *
   * For any income amount and any set of transactions (with mixed dependentId
   * assignments), the balance must equal:
   *   balance = incomeAmount - sum(transactions where dependentId === null)
   */
  it('saldo == renda - gastosUsuário (transações com dependentId === null)', () => {
    fc.assert(
      fc.property(incomeAmountArb, transactionsListArb, (income, transactions) => {
        const balance = calculateBalance(income, transactions)

        const expectedUserExpenses = transactions
          .filter((t) => t.dependentId === null)
          .reduce((sum, t) => sum + t.amount, 0)

        expect(balance).toBe(income - expectedUserExpenses)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.3, 7.1**
   *
   * When income exists but there are no transactions at all,
   * balance must equal the income (no expenses to subtract).
   */
  it('com renda e sem transações, saldo == renda', () => {
    fc.assert(
      fc.property(incomeAmountArb, (income) => {
        const balance = calculateBalance(income, [])

        expect(balance).toBe(income)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.3, 7.1**
   *
   * When no income is registered (incomeAmount is null), the balance
   * must always be null regardless of transactions.
   */
  it('sem renda (incomeAmount === null), saldo == null', () => {
    fc.assert(
      fc.property(transactionsListArb, (transactions) => {
        const balance = calculateBalance(null, transactions)

        expect(balance).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.3, 7.1**
   *
   * When all transactions are assigned to dependents (dependentId !== null),
   * user expenses are 0 and balance must equal the income.
   */
  it('com todos os gastos em dependentes (dependentId !== null), saldo == renda', () => {
    const dependentOnlyTransactionArb = fc.record({
      id: fc.uuid(),
      date: dateArb,
      description: fc.string({ minLength: 1, maxLength: 50 }),
      amount: fc.integer({ min: 1, max: 999999999 }),
      categoryId: categoryIdArb,
      dependentId: fc.uuid(), // always non-null
      source: fc.constantFrom('csv' as const, 'manual' as const),
    })

    const dependentOnlyListArb = fc.array(dependentOnlyTransactionArb, { minLength: 1, maxLength: 50 })

    fc.assert(
      fc.property(incomeAmountArb, dependentOnlyListArb, (income, transactions) => {
        const balance = calculateBalance(income, transactions)

        // All transactions are dependent expenses, so user expenses = 0
        expect(balance).toBe(income)
      }),
      { numRuns: 100 }
    )
  })
})
