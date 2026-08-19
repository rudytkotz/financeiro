// Feature: controle-financeiro, Property 6: unicidade case-insensitive (categorias)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { ServiceError } from './categoryService'

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
  categories: { id: 'id', name: 'name', isDefault: 'is_default' },
  transactions: { categoryId: 'category_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  sql: vi.fn(),
  asc: vi.fn((col) => ({ op: 'asc', col })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  count: vi.fn(() => 'count'),
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { createCategory } from './categoryService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a random case variation of a given string.
 * For each character, randomly toggles upper/lower case.
 */
const caseVariationArb = (baseName: string): fc.Arbitrary<string> =>
  fc
    .array(fc.boolean(), { minLength: baseName.length, maxLength: baseName.length })
    .map((flags) =>
      baseName
        .split('')
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join('')
    )

/**
 * Arbitrary for generating valid base category names:
 * - At least 1 char after trim
 * - At most 50 chars
 * - Contains at least one letter (to allow case variation)
 */
const baseNameArb = fc
  .stringOf(
    fc.oneof(
      fc.char().filter((c) => /[a-zA-Z]/.test(c)),
      fc.constantFrom(' ', '-', '_', '0', '1', '2')
    ),
    { minLength: 1, maxLength: 50 }
  )
  .filter((s) => {
    const trimmed = s.trim()
    return trimmed.length >= 1 && trimmed.length <= 50 && /[a-zA-Z]/.test(trimmed)
  })

// ---------------------------------------------------------------------------
// Property Test
// ---------------------------------------------------------------------------

describe('Property 6: Unicidade case-insensitive (categorias)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * **Validates: Requirements 3.3, 3.4**
   *
   * For any base category name that already exists in the database,
   * any case variation of that name must be rejected with:
   * - statusCode 409
   * - code 'DUPLICATE_NAME'
   */
  it('should reject any case variation of an existing category name with 409 DUPLICATE_NAME', () => {
    fc.assert(
      fc.asyncProperty(baseNameArb, async (baseName) => {
        const trimmedBase = baseName.trim()

        // Generate a random case variation of the base name
        const variation = await fc.sample(caseVariationArb(trimmedBase), 1)[0]
        const nameToCreate = variation ?? trimmedBase.toUpperCase()

        // Mock: simulate that a category with baseName already exists in DB
        // The DB query with lower() finds the existing entry
        mockSelect.mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
          }),
        })

        try {
          await createCategory(nameToCreate)
          // If we reach here, the property is violated
          expect.fail(
            `Expected createCategory("${nameToCreate}") to throw 409 DUPLICATE_NAME ` +
              `since "${trimmedBase}" already exists, but it did not throw.`
          )
        } catch (err) {
          const error = err as ServiceError
          expect(error.statusCode).toBe(409)
          expect(error.code).toBe('DUPLICATE_NAME')
        }
      }),
      { numRuns: 100 }
    )
  })
})
