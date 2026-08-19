import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database module before importing the service
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { associateDependent } from './transactionService.js'
import { db } from '../db/index.js'

describe('associateDependent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw 404 when transaction is not found', async () => {
    const mockLimit = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as any).mockReturnValue({ from: mockFrom })

    await expect(
      associateDependent('non-existent-id', { dependentId: 'dep-1' })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('should dissociate dependent when dependentId is null', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: 'dep-1',
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedTransaction = { ...existingTransaction, dependentId: null }

    // Mock select for finding transaction
    const mockLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.select as any).mockReturnValue({ from: mockFrom })

    // Mock update
    const mockReturning = vi.fn().mockResolvedValue([updatedTransaction])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as any).mockReturnValue({ set: mockSet })

    const result = await associateDependent('txn-1', { dependentId: null })

    expect(result).toHaveProperty('transaction')
    if ('transaction' in result) {
      expect(result.transaction.dependentId).toBeNull()
    }
  })

  it('should throw 422 when dependent does not exist', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: null,
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // First select call: find the transaction
    const mockTxnLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockTxnWhere = vi.fn().mockReturnValue({ limit: mockTxnLimit })
    const mockTxnFrom = vi.fn().mockReturnValue({ where: mockTxnWhere })

    // Second select call: find the dependent (not found)
    const mockDepLimit = vi.fn().mockResolvedValue([])
    const mockDepWhere = vi.fn().mockReturnValue({ limit: mockDepLimit })
    const mockDepFrom = vi.fn().mockReturnValue({ where: mockDepWhere })

    ;(db.select as any)
      .mockReturnValueOnce({ from: mockTxnFrom })
      .mockReturnValueOnce({ from: mockDepFrom })

    await expect(
      associateDependent('txn-1', { dependentId: 'non-existent-dep' })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'DEPENDENT_NOT_FOUND',
    })
  })

  it('should return 409 conflict when transaction already has a different dependent and force is not true', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: 'dep-1',
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // First select: find the transaction
    const mockTxnLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockTxnWhere = vi.fn().mockReturnValue({ limit: mockTxnLimit })
    const mockTxnFrom = vi.fn().mockReturnValue({ where: mockTxnWhere })

    // Second select: find the dependent (exists)
    const mockDepLimit = vi.fn().mockResolvedValue([{ id: 'dep-2' }])
    const mockDepWhere = vi.fn().mockReturnValue({ limit: mockDepLimit })
    const mockDepFrom = vi.fn().mockReturnValue({ where: mockDepWhere })

    ;(db.select as any)
      .mockReturnValueOnce({ from: mockTxnFrom })
      .mockReturnValueOnce({ from: mockDepFrom })

    const result = await associateDependent('txn-1', { dependentId: 'dep-2' })

    expect(result).toHaveProperty('conflict')
    if ('conflict' in result) {
      expect(result.conflict.code).toBe('REQUIRES_CONFIRMATION')
      expect(result.conflict.requiresConfirmation).toBe(true)
    }
  })

  it('should associate dependent when force is true even if another dependent exists', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: 'dep-1',
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedTransaction = { ...existingTransaction, dependentId: 'dep-2' }

    // First select: find the transaction
    const mockTxnLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockTxnWhere = vi.fn().mockReturnValue({ limit: mockTxnLimit })
    const mockTxnFrom = vi.fn().mockReturnValue({ where: mockTxnWhere })

    // Second select: find the dependent (exists)
    const mockDepLimit = vi.fn().mockResolvedValue([{ id: 'dep-2' }])
    const mockDepWhere = vi.fn().mockReturnValue({ limit: mockDepLimit })
    const mockDepFrom = vi.fn().mockReturnValue({ where: mockDepWhere })

    ;(db.select as any)
      .mockReturnValueOnce({ from: mockTxnFrom })
      .mockReturnValueOnce({ from: mockDepFrom })

    // Mock update
    const mockReturning = vi.fn().mockResolvedValue([updatedTransaction])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as any).mockReturnValue({ set: mockSet })

    const result = await associateDependent('txn-1', { dependentId: 'dep-2', force: true })

    expect(result).toHaveProperty('transaction')
    if ('transaction' in result) {
      expect(result.transaction.dependentId).toBe('dep-2')
    }
  })

  it('should associate dependent when transaction has no existing dependent', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: null,
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedTransaction = { ...existingTransaction, dependentId: 'dep-1' }

    // First select: find the transaction
    const mockTxnLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockTxnWhere = vi.fn().mockReturnValue({ limit: mockTxnLimit })
    const mockTxnFrom = vi.fn().mockReturnValue({ where: mockTxnWhere })

    // Second select: find the dependent (exists)
    const mockDepLimit = vi.fn().mockResolvedValue([{ id: 'dep-1' }])
    const mockDepWhere = vi.fn().mockReturnValue({ limit: mockDepLimit })
    const mockDepFrom = vi.fn().mockReturnValue({ where: mockDepWhere })

    ;(db.select as any)
      .mockReturnValueOnce({ from: mockTxnFrom })
      .mockReturnValueOnce({ from: mockDepFrom })

    // Mock update
    const mockReturning = vi.fn().mockResolvedValue([updatedTransaction])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as any).mockReturnValue({ set: mockSet })

    const result = await associateDependent('txn-1', { dependentId: 'dep-1' })

    expect(result).toHaveProperty('transaction')
    if ('transaction' in result) {
      expect(result.transaction.dependentId).toBe('dep-1')
    }
  })

  it('should not conflict when assigning the same dependent that is already associated', async () => {
    const existingTransaction = {
      id: 'txn-1',
      date: '2024-01-15',
      description: 'Test',
      amount: 5000,
      categoryId: 'cat-1',
      dependentId: 'dep-1',
      source: 'manual',
      importId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // First select: find the transaction (already has dep-1)
    const mockTxnLimit = vi.fn().mockResolvedValue([existingTransaction])
    const mockTxnWhere = vi.fn().mockReturnValue({ limit: mockTxnLimit })
    const mockTxnFrom = vi.fn().mockReturnValue({ where: mockTxnWhere })

    // Second select: find the dependent (exists)
    const mockDepLimit = vi.fn().mockResolvedValue([{ id: 'dep-1' }])
    const mockDepWhere = vi.fn().mockReturnValue({ limit: mockDepLimit })
    const mockDepFrom = vi.fn().mockReturnValue({ where: mockDepWhere })

    ;(db.select as any)
      .mockReturnValueOnce({ from: mockTxnFrom })
      .mockReturnValueOnce({ from: mockDepFrom })

    // Mock update (same dependent, no conflict)
    const mockReturning = vi.fn().mockResolvedValue([existingTransaction])
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    ;(db.update as any).mockReturnValue({ set: mockSet })

    const result = await associateDependent('txn-1', { dependentId: 'dep-1' })

    // Should not return conflict since it's the same dependent
    expect(result).toHaveProperty('transaction')
  })
})
