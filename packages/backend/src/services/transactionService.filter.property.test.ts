// Feature: controle-financeiro, Property 4: filtros preservam subconjunto e total
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure filtering logic (extracted from TransactionService.listTransactions)
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

interface FilterParams {
  month?: string        // YYYY-MM
  categoryId?: string
  startDate?: string    // YYYY-MM-DD
  endDate?: string      // YYYY-MM-DD
}

interface FilterResult {
  transactions: TransactionRecord[]
  total: number
}

/**
 * Pure filtering function that replicates the listTransactions filtering logic
 * without any database dependency.
 */
function filterTransactions(
  allTransactions: TransactionRecord[],
  params: FilterParams
): FilterResult {
  const { month, categoryId, startDate, endDate } = params

  let filtered = [...allTransactions]

  // Filtro por mês (YYYY-MM) — filtra entre primeiro e último dia do mês
  if (month) {
    const range = getMonthRange(month)
    if (range) {
      filtered = filtered.filter(
        (t) => t.date >= range.firstDay && t.date <= range.lastDay
      )
    }
  }

  // Filtro por categoria
  if (categoryId) {
    filtered = filtered.filter((t) => t.categoryId === categoryId)
  }

  // Filtro por intervalo de datas (ambos devem ser fornecidos e startDate <= endDate)
  if (startDate && endDate) {
    if (isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate) {
      filtered = filtered.filter(
        (t) => t.date >= startDate && t.date <= endDate
      )
    }
    // Se startDate > endDate ou datas inválidas, ignora o filtro (retorna tudo)
  }

  // Total é a soma dos amounts das transações filtradas
  const total = filtered.reduce((sum, t) => sum + t.amount, 0)

  return { transactions: filtered, total }
}

// ---------------------------------------------------------------------------
// Helper functions (same logic as in transactionService.ts)
// ---------------------------------------------------------------------------

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value)
}

function getMonthRange(month: string): { firstDay: string; lastDay: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null

  const year = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m < 1 || m > 12) return null

  const firstDay = `${month}-01`
  const lastDate = new Date(year, m, 0)
  const lastDay = `${year}-${String(m).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { firstDay, lastDay }
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

/** Generate a valid month string in YYYY-MM format */
const monthArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 })
  )
  .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`)

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

/** Generate filter params — each filter is optionally present */
const filterParamsArb = fc.record({
  month: fc.option(monthArb, { nil: undefined }),
  categoryId: fc.option(categoryIdArb, { nil: undefined }),
  startDate: fc.option(dateArb, { nil: undefined }),
  endDate: fc.option(dateArb, { nil: undefined }),
})

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 4: Filtros preservam subconjunto e total corretos', () => {
  /**
   * **Validates: Requirements 2.2, 2.3, 2.5**
   *
   * For any list of transactions and any combination of filters (month, categoryId,
   * startDate/endDate), the result must contain exactly the transactions that satisfy
   * all active filter criteria, and the total must equal the sum of their amounts.
   */
  it('filtered result contains exactly the transactions satisfying all active filters and total equals sum of amounts', () => {
    fc.assert(
      fc.property(transactionsListArb, filterParamsArb, (txns, params) => {
        const result = filterTransactions(txns, params)

        // Manually compute expected subset by applying each filter independently
        let expected = [...txns]

        // Apply month filter
        if (params.month) {
          const range = getMonthRange(params.month)
          if (range) {
            expected = expected.filter(
              (t) => t.date >= range.firstDay && t.date <= range.lastDay
            )
          }
        }

        // Apply category filter
        if (params.categoryId) {
          expected = expected.filter((t) => t.categoryId === params.categoryId)
        }

        // Apply date range filter (only if both provided and valid)
        if (params.startDate && params.endDate) {
          if (
            isValidDate(params.startDate) &&
            isValidDate(params.endDate) &&
            params.startDate <= params.endDate
          ) {
            expected = expected.filter(
              (t) => t.date >= params.startDate! && t.date <= params.endDate!
            )
          }
        }

        // Property: result.transactions contains exactly the expected subset
        const resultIds = result.transactions.map((t) => t.id).sort()
        const expectedIds = expected.map((t) => t.id).sort()
        expect(resultIds).toEqual(expectedIds)

        // Property: total is exactly the sum of amounts of filtered transactions
        const expectedTotal = expected.reduce((sum, t) => sum + t.amount, 0)
        expect(result.total).toBe(expectedTotal)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.2, 2.3, 2.5**
   *
   * Filtered result is always a subset of the original transactions —
   * no transaction appears in the result that wasn't in the input.
   */
  it('filtered result is always a subset of the input transactions', () => {
    fc.assert(
      fc.property(transactionsListArb, filterParamsArb, (txns, params) => {
        const result = filterTransactions(txns, params)

        const inputIds = new Set(txns.map((t) => t.id))
        for (const t of result.transactions) {
          expect(inputIds.has(t.id)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.5**
   *
   * With no filters applied, the result contains all transactions and the total
   * equals the sum of all amounts.
   */
  it('with no filters, result contains all transactions and total equals sum of all amounts', () => {
    fc.assert(
      fc.property(transactionsListArb, (txns) => {
        const result = filterTransactions(txns, {})

        expect(result.transactions.length).toBe(txns.length)
        const expectedTotal = txns.reduce((sum, t) => sum + t.amount, 0)
        expect(result.total).toBe(expectedTotal)
      }),
      { numRuns: 100 }
    )
  })
})
