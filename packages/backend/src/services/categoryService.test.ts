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
  categories: { id: 'id', name: 'name', isDefault: 'is_default', userId: 'user_id' },
  transactions: { categoryId: 'category_id', userId: 'user_id' },
}))

// Mock drizzle-orm operators so the service's query builders don't break
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...conds) => ({ op: 'and', conds })),
  or: vi.fn((...conds) => ({ op: 'or', conds })),
  isNull: vi.fn((col) => ({ op: 'isNull', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values })),
  asc: vi.fn((col) => ({ op: 'asc', col })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  count: vi.fn(() => 'count'),
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { listCategories, createCategory, deleteCategory } from './categoryService'

const TEST_USER = 'user-1'

// Lista de categorias "default" completa o suficiente para que listCategories
// não dispare o seed nem o sync (evita ramos que exigem mocks adicionais).
// Reproduz os nomes padrão do serviço.
const DEFAULT_NAMES = [
  'Alimentação', 'Assinaturas e serviços', 'Bares e restaurantes', 'Casa',
  'Compras', 'Cuidados pessoais', 'Dívidas e empréstimos', 'Educação',
  'Lazer e hobbies', 'Mercado', 'Outros', 'Pets', 'Presentes', 'Roupas',
  'Saúde', 'Trabalho', 'Transporte', 'Viagem',
]

/** Mocks a `db.select().from().where().limit()` chain resolving to `rows`. */
function selectWhereLimit(rows: unknown[]) {
  return { where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }) }
}

/** Mocks a `db.select().from().where()` chain resolving to `rows` (no limit). */
function selectWhere(rows: unknown[]) {
  return { where: vi.fn().mockResolvedValue(rows) }
}

describe('CategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // listCategories
  // =========================================================================
  describe('listCategories', () => {
    it('returns existing categories when defaults are already in sync', async () => {
      const existing = DEFAULT_NAMES.map((name, i) => ({
        id: String(i + 1),
        name,
        isDefault: true,
        userId: TEST_USER,
      }))

      // Primeira (e única) consulta: select().from().where().orderBy()
      mockSelect.mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(existing),
        }),
      })

      const result = await listCategories(TEST_USER)
      expect(result).toEqual(existing)
      expect(mockSelect).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // createCategory
  // =========================================================================
  describe('createCategory', () => {
    it('should throw 422 VALIDATION_ERROR when name is empty', async () => {
      try {
        await createCategory('', TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 422 VALIDATION_ERROR when name is only whitespace', async () => {
      try {
        await createCategory('   ', TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 422 VALIDATION_ERROR when name exceeds 50 characters', async () => {
      try {
        await createCategory('a'.repeat(51), TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(422)
        expect(error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should throw 409 DUPLICATE_NAME when name already exists (case-insensitive)', async () => {
      mockSelect.mockReturnValue(selectWhereLimit([{ id: 'existing-id' }]))

      try {
        await createCategory('Alimentação', TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('DUPLICATE_NAME')
      }
    })

    it('should create and return category when valid', async () => {
      const newCategory = { id: 'new-id', name: 'Streaming', isDefault: false, userId: TEST_USER }
      mockSelect.mockReturnValue(selectWhereLimit([])) // no duplicate
      mockInsert.mockReturnValue({ returning: vi.fn().mockResolvedValue([newCategory]) })

      const result = await createCategory('Streaming', TEST_USER)
      expect(result).toEqual(newCategory)
    })

    it('should trim whitespace from name before creating', async () => {
      const newCategory = { id: 'new-id', name: 'Streaming', isDefault: false, userId: TEST_USER }
      mockSelect.mockReturnValue(selectWhereLimit([]))
      mockInsert.mockReturnValue({ returning: vi.fn().mockResolvedValue([newCategory]) })

      const result = await createCategory('  Streaming  ', TEST_USER)
      expect(result).toEqual(newCategory)
    })

    it('should accept name with exactly 50 characters', async () => {
      const name50 = 'a'.repeat(50)
      const newCategory = { id: 'new-id', name: name50, isDefault: false, userId: TEST_USER }
      mockSelect.mockReturnValue(selectWhereLimit([]))
      mockInsert.mockReturnValue({ returning: vi.fn().mockResolvedValue([newCategory]) })

      const result = await createCategory(name50, TEST_USER)
      expect(result).toEqual(newCategory)
    })
  })

  // =========================================================================
  // deleteCategory
  // =========================================================================
  describe('deleteCategory', () => {
    it('should throw 404 NOT_FOUND when category does not exist', async () => {
      mockSelect.mockReturnValue(selectWhereLimit([]))

      try {
        await deleteCategory('non-existent-id', TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(404)
        expect(error.code).toBe('NOT_FOUND')
      }
    })

    it('should throw 409 HAS_TRANSACTIONS when category has linked transactions', async () => {
      mockSelect
        // 1) busca a categoria (pertence ao usuário)
        .mockReturnValueOnce(selectWhereLimit([{ id: 'cat-2', name: 'Lazer', isDefault: false, userId: TEST_USER }]))
        // 2) conta transações vinculadas
        .mockReturnValueOnce(selectWhere([{ total: 3 }]))

      try {
        await deleteCategory('cat-2', TEST_USER)
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as ServiceError
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('HAS_TRANSACTIONS')
      }
    })

    it('should delete category when it has no transactions', async () => {
      mockSelect
        .mockReturnValueOnce(selectWhereLimit([{ id: 'cat-3', name: 'Custom', isDefault: false, userId: TEST_USER }]))
        .mockReturnValueOnce(selectWhere([{ total: 0 }]))
      mockDelete.mockResolvedValue(undefined)

      await deleteCategory('cat-3', TEST_USER)
      expect(mockDelete).toHaveBeenCalled()
    })
  })
})
