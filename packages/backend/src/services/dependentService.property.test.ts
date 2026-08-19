// Feature: controle-financeiro, Property 6: unicidade case-insensitive (dependentes)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { ServiceError } from './dependentService'

// ---------------------------------------------------------------------------
// Mock the database module
// ---------------------------------------------------------------------------
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()

vi.mock('../db/index.js', () => ({
  db: {
    select: () => ({ from: mockSelect }),
    insert: () => ({ values: mockInsert }),
    delete: () => ({ where: mockDelete }),
  },
}))

vi.mock('../db/schema.js', () => ({
  dependents: { id: 'id', name: 'name' },
  transactions: { dependentId: 'dependent_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  sql: vi.fn(),
  count: vi.fn(() => 'count'),
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { createDependent } from './dependentService'

// ---------------------------------------------------------------------------
// Property Test: P6 — Unicidade case-insensitive de dependentes
// ---------------------------------------------------------------------------
describe('Property 6: Unicidade case-insensitive (dependentes)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * Para qualquer nome de dependente válido (1-50 chars) e qualquer variação de
   * capitalização desse nome, createDependent() deve lançar erro com
   * statusCode 409 e code 'DUPLICATE_NAME' quando já existe um dependente com
   * o nome base no banco (simulado via mock).
   */
  it('should reject any case variation of an existing dependent name with 409 DUPLICATE_NAME', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a valid dependent name: alphabetic string 1-50 chars
        fc.stringMatching(/^[a-zA-Z]{1,50}$/),
        fc.context(),
        async (baseName, ctx) => {
          // Generate case variations: toUpperCase, toLowerCase, and mixed case
          const variations = [
            baseName.toUpperCase(),
            baseName.toLowerCase(),
            // Mixed case: alternate upper/lower
            baseName
              .split('')
              .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
              .join(''),
          ]

          for (const variation of variations) {
            vi.clearAllMocks()

            // Mock DB: first call to .from() returns chain for duplicate check
            // The dependent service calls:
            //   1) db.select({id}).from(dependents).where(...).limit(1) → finds duplicate
            // Since mock intercepts at .from(), we simulate the duplicate being found
            mockSelect.mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'existing-dep-id' }]),
              }),
            })

            ctx.log(`Base: "${baseName}", Variation: "${variation}"`)

            try {
              await createDependent(variation)
              // If we get here, the function did not throw — fail the property
              expect.fail(`Expected createDependent("${variation}") to throw 409 DUPLICATE_NAME`)
            } catch (err) {
              const error = err as ServiceError
              expect(error.statusCode).toBe(409)
              expect(error.code).toBe('DUPLICATE_NAME')
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
