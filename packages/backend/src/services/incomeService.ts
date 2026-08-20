import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { income } from '../db/schema.js'
import type { Income } from '../db/schema.js'

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

export async function getIncome(month: string, userId: string): Promise<Income | null> {
  const [record] = await db
    .select()
    .from(income)
    .where(and(eq(income.month, month), eq(income.userId, userId)))
    .limit(1)

  return record ?? null
}

export async function setIncome(month: string, amount: number, userId: string): Promise<Income> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 99_999_999_999) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor da renda deve ser entre R$ 0,01 e R$ 999.999.999,99.')
  }

  // Check if exists for this user+month
  const [existing] = await db
    .select({ id: income.id })
    .from(income)
    .where(and(eq(income.month, month), eq(income.userId, userId)))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(income)
      .set({ amount })
      .where(eq(income.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(income)
    .values({ month, amount, userId })
    .returning()

  return created
}
