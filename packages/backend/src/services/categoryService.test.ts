import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// We need to mock drizzle-orm operators so they don't break
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
import { listCategories, createCategory, deleteCategory } from './categoryService'

describe('CategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // listCategories
  // =========================================================================
  describe('listCategories', () => {
    it('should return categories ordered by isDefault DESC, name ASC', async () => {
      const mockCategories = [
        { id: '1', name: 'Alimentação', isDefault: true },
        { id: '2', name: 'Transporte', isDefault: true },
        { id: '3', name: 'Lazer', isDefault: false },
      ]

      mockSelect.mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(mockCategories),
      })

      const result = await listCategories()
      expect(result).toEqual(mockCategories)
      expect(mockSelect).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // createCategory
  // =========================================================================
  describe('createCategory', () => {
    it('should throw 422 VALIDATION_ERROR when name is empty', async () => {
      try {
        await createCategory('')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 422 VALIDATION_ERROR when name is only whitespace', async () => {
      try {
        await createCategory('   ')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 422 VALIDATION_ERROR when name exceeds 50 characters', async () => {
      const longName = 'a'.repeat(51)
      try {
        await createCategory(longName)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 409 DUPLICATE_NAME when name already exists (case-insensitive)', async () => {
      // Mock: duplicate found
      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      })

      try {
        await createCategory('Alimentação')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('DUPLICATE_NAME')
      }
    })

    it('should create and return category when valid', async () => {
      const newCategory = { id: 'new-id', name: 'Streaming', isDefault: false }

      // Mock: no duplicate found
      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      // Mock: insert
      mockInsert.mockReturnValue({
        returning: vi.fn().mockResolvedValue([newCategory]),
      })

      const result = await createCategory('Streaming')
      expect(result).toEqual(newCategory)
    })

    it('should trim whitespace from name before creating', async () => {
      const newCategory = { id: 'new-id', name: 'Streaming', isDefault: false }

      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      mockInsert.mockReturnValue({
        returning: vi.fn().mockResolvedValue([newCategory]),
      })

      const result = await createCategory('  Streaming  ')
      expect(result).toEqual(newCategory)
    })

    it('should accept name with exactly 50 characters', async () => {
      const name50 = 'a'.repeat(50)
      const newCategory = { id: 'new-id', name: name50, isDefault: false }

      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      mockInsert.mockReturnValue({
        returning: vi.fn().mockResolvedValue([newCategory]),
      })

      const result = await createCategory(name50)
      expect(result).toEqual(newCategory)
    })
  })

  // =========================================================================
  // deleteCategory
  // =========================================================================
  describe('deleteCategory', () => {
    it('should throw 404 NOT_FOUND when category does not exist', async () => {
      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      try {
        await deleteCategory('non-existent-id')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(404)
        expect(error.code).toBe('NOT_FOUND')
      }
    })

    it('should throw 409 IS_DEFAULT when category is default', async () => {
      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Alimentação', isDefault: true }]),
        }),
      })

      try {
        await deleteCategory('cat-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('IS_DEFAULT')
      }
    })

    it('should throw 409 HAS_TRANSACTIONS when category has linked transactions', async () => {
      // First call: select category (not default)
      mockSelect
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'cat-2', name: 'Lazer', isDefault: false }]),
          }),
        })
        // Second call: count transactions
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue([{ total: 3 }]),
        })

      try {
        await deleteCategory('cat-2')
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('HAS_TRANSACTIONS')
      }
    })

    it('should delete category when it is custom and has no transactions', async () => {
      // First call: select category (not default)
      mockSelect
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'cat-3', name: 'Custom', isDefault: false }]),
          }),
        })
        // Second call: count transactions = 0
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        })

      mockDelete.mockResolvedValue(undefined)

      await deleteCategory('cat-3')
      expect(mockDelete).toHaveBeenCalled()
    })
  })
})
