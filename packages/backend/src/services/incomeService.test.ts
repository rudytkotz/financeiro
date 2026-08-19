import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database module before importing the service
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

import { getIncome, setIncome } from './incomeService.js'
import { db } from '../db/index.js'

describe('incomeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setIncome — validation', () => {
    it('should throw 422 when amount is 0', async () => {
      await expect(setIncome('2024-01', 0)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount is negative', async () => {
      await expect(setIncome('2024-01', -100)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount exceeds 99999999999', async () => {
      await expect(setIncome('2024-01', 100_000_000_000)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should throw 422 when amount is not an integer', async () => {
      await expect(setIncome('2024-01', 100.5)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      })
    })

    it('should accept amount = 1 (minimum valid)', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 1 }
      const mockReturning = vi.fn().mockResolvedValue([mockRecord])
      const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
      ;(db.insert as any).mockReturnValue({ values: mockValues })

      const result = await setIncome('2024-01', 1)
      expect(result).toEqual(mockRecord)
    })

    it('should accept amount = 99999999999 (maximum valid)', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 99_999_999_999 }
      const mockReturning = vi.fn().mockResolvedValue([mockRecord])
      const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
      ;(db.insert as any).mockReturnValue({ values: mockValues })

      const result = await setIncome('2024-01', 99_999_999_999)
      expect(result).toEqual(mockRecord)
    })
  })

  describe('getIncome', () => {
    it('should return null when no record found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      ;(db.select as any).mockReturnValue({ from: mockFrom })

      const result = await getIncome('2024-01')
      expect(result).toBeNull()
    })

    it('should return the income record when found', async () => {
      const mockRecord = { id: '1', month: '2024-01', amount: 500000 }
      const mockLimit = vi.fn().mockResolvedValue([mockRecord])
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
      ;(db.select as any).mockReturnValue({ from: mockFrom })

      const result = await getIncome('2024-01')
      expect(result).toEqual(mockRecord)
    })
  })
})
