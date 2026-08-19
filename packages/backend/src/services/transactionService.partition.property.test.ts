// Feature: controle-financeiro, Property 7: invariante de particionamento financeiro
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
// Pure partitioning logic
// ---------------------------------------------------------------------------

interface PartitionResult {
  totalUsuario: number
  somaDependentes: number
  totalGeral: number
}

/**
 * Partitions transactions into user expenses (dependentId === null)
 * and dependent expenses (dependentId !== null), computing totals for each.
 */
function partitionTransactions(transactions: TransactionRecord[]): PartitionResult {
  let totalUsuario = 0
  let somaDependentes = 0

  for (const t of transactions) {
    if (t.dependentId === null) {
      totalUsuario += t.amount
    } else {
      somaDependentes += t.amount
    }
  }

  const totalGeral = transactions.reduce((sum, t) => sum + t.amount, 0)

  return { totalUsuario, somaDependentes, totalGeral }
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

/** Generate a single transaction record where dependentId can be null or a UUID */
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

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 7: Invariante de particionamento financeiro (usuário + dependentes = total)', () => {
  /**
   * **Validates: Requirements 4.2, 4.4**
   *
   * For any set of transactions where each transaction may or may not have a
   * dependentId, the following invariant must hold:
   *   totalUsuário + somaDependentes == totalGeral
   *
   * Where:
   *   totalUsuário = sum of amounts where dependentId === null
   *   somaDependentes = sum of amounts where dependentId !== null
   *   totalGeral = sum of all amounts
   */
  it('totalUsuário + somaDependentes == totalGeral for any set of transactions', () => {
    fc.assert(
      fc.property(transactionsListArb, (transactions) => {
        const { totalUsuario, somaDependentes, totalGeral } = partitionTransactions(transactions)

        // Core invariant: partition sums must equal the total
        expect(totalUsuario + somaDependentes).toBe(totalGeral)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.2, 4.4**
   *
   * Transactions with dependentId === null contribute exclusively to totalUsuário,
   * and transactions with dependentId !== null contribute exclusively to somaDependentes.
   */
  it('each transaction contributes to exactly one partition (user or dependent)', () => {
    fc.assert(
      fc.property(transactionsListArb, (transactions) => {
        const userTransactions = transactions.filter((t) => t.dependentId === null)
        const dependentTransactions = transactions.filter((t) => t.dependentId !== null)

        // The two partitions are exhaustive and mutually exclusive
        expect(userTransactions.length + dependentTransactions.length).toBe(transactions.length)

        const { totalUsuario, somaDependentes } = partitionTransactions(transactions)

        // totalUsuário equals sum of user-only transactions
        const expectedUserTotal = userTransactions.reduce((sum, t) => sum + t.amount, 0)
        expect(totalUsuario).toBe(expectedUserTotal)

        // somaDependentes equals sum of dependent-only transactions
        const expectedDependentTotal = dependentTransactions.reduce((sum, t) => sum + t.amount, 0)
        expect(somaDependentes).toBe(expectedDependentTotal)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.2, 4.4**
   *
   * Edge case: when all transactions belong to the user (no dependents),
   * totalUsuário == totalGeral and somaDependentes == 0.
   */
  it('when no transactions have dependents, totalUsuário == totalGeral and somaDependentes == 0', () => {
    const userOnlyTransactionArb = fc.record({
      id: fc.uuid(),
      date: dateArb,
      description: fc.string({ minLength: 1, maxLength: 50 }),
      amount: fc.integer({ min: 1, max: 999999999 }),
      categoryId: categoryIdArb,
      dependentId: fc.constant(null),
      source: fc.constantFrom('csv' as const, 'manual' as const),
    })

    const userOnlyListArb = fc.array(userOnlyTransactionArb, { minLength: 1, maxLength: 50 })

    fc.assert(
      fc.property(userOnlyListArb, (transactions) => {
        const { totalUsuario, somaDependentes, totalGeral } = partitionTransactions(transactions)

        expect(somaDependentes).toBe(0)
        expect(totalUsuario).toBe(totalGeral)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.2, 4.4**
   *
   * Edge case: when all transactions are assigned to dependents,
   * somaDependentes == totalGeral and totalUsuário == 0.
   */
  it('when all transactions have dependents, somaDependentes == totalGeral and totalUsuário == 0', () => {
    const dependentOnlyTransactionArb = fc.record({
      id: fc.uuid(),
      date: dateArb,
      description: fc.string({ minLength: 1, maxLength: 50 }),
      amount: fc.integer({ min: 1, max: 999999999 }),
      categoryId: categoryIdArb,
      dependentId: fc.uuid(),  // always non-null
      source: fc.constantFrom('csv' as const, 'manual' as const),
    })

    const dependentOnlyListArb = fc.array(dependentOnlyTransactionArb, { minLength: 1, maxLength: 50 })

    fc.assert(
      fc.property(dependentOnlyListArb, (transactions) => {
        const { totalUsuario, somaDependentes, totalGeral } = partitionTransactions(transactions)

        expect(totalUsuario).toBe(0)
        expect(somaDependentes).toBe(totalGeral)
      }),
      { numRuns: 100 }
    )
  })
})
