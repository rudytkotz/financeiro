// Feature: controle-financeiro, Property 8: reversibilidade de desassociação
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Pure domain types
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

interface Totals {
  userTotal: number
  dependentTotals: Record<string, number>
}

// ---------------------------------------------------------------------------
// Pure domain logic
// ---------------------------------------------------------------------------

/**
 * Calculates user total (transactions without dependentId) and
 * per-dependent totals from a list of transactions.
 */
function calculateTotals(transactions: TransactionRecord[]): Totals {
  let userTotal = 0
  const dependentTotals: Record<string, number> = {}

  for (const t of transactions) {
    if (t.dependentId === null) {
      userTotal += t.amount
    } else {
      dependentTotals[t.dependentId] = (dependentTotals[t.dependentId] ?? 0) + t.amount
    }
  }

  return { userTotal, dependentTotals }
}

/**
 * Associates a transaction with a dependent (sets dependentId).
 * Returns a new array with the updated transaction.
 */
function associateDependent(
  transactions: TransactionRecord[],
  transactionId: string,
  dependentId: string
): TransactionRecord[] {
  return transactions.map((t) =>
    t.id === transactionId ? { ...t, dependentId } : t
  )
}

/**
 * Dissociates a transaction from its dependent (sets dependentId = null).
 * Returns a new array with the updated transaction.
 */
function dissociateDependent(
  transactions: TransactionRecord[],
  transactionId: string
): TransactionRecord[] {
  return transactions.map((t) =>
    t.id === transactionId ? { ...t, dependentId: null } : t
  )
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

/** Generate a single transaction record WITHOUT any dependent assigned */
const transactionWithoutDependentArb = fc.record({
  id: fc.uuid(),
  date: dateArb,
  description: fc.string({ minLength: 1, maxLength: 50 }),
  amount: fc.integer({ min: 1, max: 999999999 }),
  categoryId: categoryIdArb,
  dependentId: fc.constant(null as null),
  source: fc.constantFrom('csv' as const, 'manual' as const),
})

/** Generate a list of transactions (1 to 20) with NO dependents assigned */
const transactionsListArb = fc.array(transactionWithoutDependentArb, { minLength: 1, maxLength: 20 })

/** Generate a dependent ID */
const dependentIdArb = fc.uuid()

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Property 8: Reversibilidade de desassociação de dependente', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any set of transactions where none has a dependent assigned,
   * associating one transaction to a dependent and then dissociating it
   * must produce a final state (user totals and dependent totals) identical
   * to the initial state.
   */
  it('associating and then dissociating a dependent restores original totals', () => {
    fc.assert(
      fc.property(
        transactionsListArb,
        dependentIdArb,
        (transactions, dependentId) => {
          // Pick a random transaction index to associate
          const targetIndex = Math.floor(Math.random() * transactions.length)
          const targetId = transactions[targetIndex].id

          // Initial state: all transactions belong to the user
          const initialTotals = calculateTotals(transactions)

          // Step 1: Associate the target transaction with the dependent
          const afterAssociation = associateDependent(transactions, targetId, dependentId)
          const associatedTotals = calculateTotals(afterAssociation)

          // Verify the association had an effect:
          // - user total decreased by the transaction amount
          // - dependent total increased by the transaction amount
          const txAmount = transactions[targetIndex].amount
          expect(associatedTotals.userTotal).toBe(initialTotals.userTotal - txAmount)
          expect(associatedTotals.dependentTotals[dependentId] ?? 0).toBe(txAmount)

          // Step 2: Dissociate the transaction
          const afterDissociation = dissociateDependent(afterAssociation, targetId)
          const finalTotals = calculateTotals(afterDissociation)

          // Property: final state equals initial state
          expect(finalTotals.userTotal).toBe(initialTotals.userTotal)
          expect(finalTotals.dependentTotals).toEqual(initialTotals.dependentTotals)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.4**
   *
   * For any transaction associated to a dependent, dissociating it must
   * return the transaction's amount to the user's total and reduce the
   * dependent's total by exactly the same amount.
   */
  it('dissociation transfers amount back from dependent to user exactly', () => {
    fc.assert(
      fc.property(
        transactionsListArb,
        dependentIdArb,
        (transactions, dependentId) => {
          // Pick a transaction to work with
          const targetIndex = Math.floor(Math.random() * transactions.length)
          const targetId = transactions[targetIndex].id
          const txAmount = transactions[targetIndex].amount

          // Start with the transaction already associated
          const withAssociation = associateDependent(transactions, targetId, dependentId)
          const beforeDissociation = calculateTotals(withAssociation)

          // Dissociate
          const afterDissociation = dissociateDependent(withAssociation, targetId)
          const afterTotals = calculateTotals(afterDissociation)

          // User total increases by exactly the transaction amount
          expect(afterTotals.userTotal).toBe(beforeDissociation.userTotal + txAmount)

          // Dependent total decreases by exactly the transaction amount
          const depBefore = beforeDissociation.dependentTotals[dependentId] ?? 0
          const depAfter = afterTotals.dependentTotals[dependentId] ?? 0
          expect(depAfter).toBe(depBefore - txAmount)
        }
      ),
      { numRuns: 100 }
    )
  })
})
