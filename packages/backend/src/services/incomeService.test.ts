import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database module before importing the service
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

// Mock drizzle-orm operators so the service's query builders don't break
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...conds) => ({ op: 'and', conds })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values })),
}))

import { getIncome, setIncome } from './incomeService.js'
import { db } from '../db/index.js'

const TEST_USER = 'user-1'

/** Mocks a `db.select().from().where().limit()` chain resolving to `rows`. */
function mockSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

describe('incomeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setIncome — validation', () => {
    it('should throw 422 when amount is 0', async () => {
      await expect(setIncome('2024-01', 0, TEST_USER)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount is negative', async () => {
      await expect(setIncome('2024-01', -100, TEST_USER)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount exceeds 99999999999', async () => {
      await expect(setIncome('2024-01', 100_000_000_000, TEST_USER)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount is not an integer', async () => {
      await expect(setIncome('2024-01', 100.5, TEST_USER)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should accept amount = 1 (minimum valid)', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 1, userId: TEST_USER }
      // setIncome: 1) busca existing (vazio), 2) insere
      ;(db.select as any).mockReturnValueOnce(mockSelectChain([]))
      const returning = vi.fn().mockResolvedValue([mockRecord])
      ;(db.insert as any).mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) })

      const result = await setIncome('2024-01', 1, TEST_USER)
      expect(result).toEqual(mockRecord)
    })

    it('should accept amount = 99999999999 (maximum valid)', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 99_999_999_999, userId: TEST_USER }
      ;(db.select as any).mockReturnValueOnce(mockSelectChain([]))
      const returning = vi.fn().mockResolvedValue([mockRecord])
      ;(db.insert as any).mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) })

      const result = await setIncome('2024-01', 99_999_999_999, TEST_USER)
      expect(result).toEqual(mockRecord)
    })
  })

  describe('getIncome', () => {
    it('should return null when no record found', async () => {
      // getIncome agora faz uma única busca, estritamente pelo usuário
      ;(db.select as any).mockReturnValueOnce(mockSelectChain([]))

      const result = await getIncome('2024-01', TEST_USER)
      expect(result).toBeNull()
    })

    it('should return the income record when found', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 500000, userId: TEST_USER }
      ;(db.select as any).mockReturnValueOnce(mockSelectChain([mockRecord]))

      const result = await getIncome('2024-01', TEST_USER)
      expect(result).toEqual(mockRecord)
    })
  })
})
