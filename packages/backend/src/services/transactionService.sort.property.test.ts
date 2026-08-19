// Feature: controle-financeiro, Property 5: ordenação preserva conjunto
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure sorting logic (extracted from TransactionService.listTransactions)
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

type SortCriteria = 'amount_desc' | 'date_desc'

/**
 * Pure sorting function that replicates the listTransactions ordering logic
 * without any database dependency.
 *
 * - 'amount_desc': orders by amount descending
 * - 'date_desc': orders by date descending (lexicographic, since YYYY-MM-DD is sortable)
 */
function sortTransactions(
  transactions: TransactionRecord[],
  sort: SortCriteria
): TransactionRecord[] {
  const sorted = [...transactions]

  if (sort === 'amount_desc') {
    sorted.sort((a, b) => b.amount - a.amount)
  } else {
    // date_desc: lexicographic descending comparison on YYYY-MM-DD strings
    sorted.sort((a, b) => b.date.localeCompare(a.date))
  }

  return sorted
}

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

/** Generate a valid date string in YYYY-MM-DD format within a reasonable range */
const dateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),  // year
    fc.integer({ min: 1, max: 12 }),        // month
    fc.integer({ min: 1, max: 28 })         // day (max 28 to avoid invalid dates)
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

/** Generate a category ID from a small pool */
const categoryIdArb = fc.constantFrom('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5')

/** Generate a single transaction record */
const transactionArb = fc.record({
  id: fc.uuid(),
  date: dateArb,
  description: fc.string({ minLength: 1, maxLength: 50 }),
  amount: fc.integer({ min: 1, max: 999999999 }),
  categoryId: categoryIdArb,
  dependentId: fc.option(fc.uuid(), { nil: null }),
  source: fc.constantFrom('csv' as const, 'manual' as const),
})

/** Generate a list of transactions (1 to 30 items) */
const transactionsListArb = fc.array(transactionArb, { minLength: 1, maxLength: 30 })

/** Generate a sort criteria */
const sortArb = fc.constantFrom<SortCriteria>('amount_desc', 'date_desc')

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 5: Ordenação preserva o conjunto sem alterar os elementos', () => {
  /**
   * **Validates: Requirements 2.7, 2.8**
   *
   * For any list of transactions and any sort criteria (amount_desc or date_desc),
   * the sorted list must contain the exact same set of elements as the original
   * (same ids, same count).
   */
  it('sorted list contains the same elements as the original (same ids)', () => {
    fc.assert(
      fc.property(transactionsListArb, sortArb, (txns, sort) => {
        const sorted = sortTransactions(txns, sort)

        // Same length
        expect(sorted.length).toBe(txns.length)

        // Same set of ids (sorted for comparison)
        const originalIds = txns.map((t) => t.id).sort()
        const sortedIds = sorted.map((t) => t.id).sort()
        expect(sortedIds).toEqual(originalIds)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.7**
   *
   * When sorted by amount_desc, the resulting list must have amounts in
   * non-increasing order (each element's amount >= next element's amount).
   */
  it('sort by amount_desc produces non-increasing amounts', () => {
    fc.assert(
      fc.property(transactionsListArb, (txns) => {
        const sorted = sortTransactions(txns, 'amount_desc')

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].amount).toBeGreaterThanOrEqual(sorted[i + 1].amount)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.8**
   *
   * When sorted by date_desc, the resulting list must have dates in
   * non-increasing lexicographic order (most recent first).
   */
  it('sort by date_desc produces non-increasing dates (most recent first)', () => {
    fc.assert(
      fc.property(transactionsListArb, (txns) => {
        const sorted = sortTransactions(txns, 'date_desc')

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].date >= sorted[i + 1].date).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})
