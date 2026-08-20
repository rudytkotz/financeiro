import { eq, and, sql } from 'drizzle-orm'
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
  // Try user-specific first
  const [record] = await db
    .select()
    .from(income)
    .where(and(eq(income.month, month), eq(income.userId, userId)))
    .limit(1)

  if (record) return record

  // Fallback: legacy record without userId
  const [legacy] = await db
    .select()
    .from(income)
    .where(sql`${income.month} = ${month} AND ${income.userId} IS NULL`)
    .limit(1)

  return legacy ?? null
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

  // Check for legacy record (no userId) and claim it
  const [legacy] = await db
    .select({ id: income.id })
    .from(income)
    .where(sql`${income.month} = ${month} AND ${income.userId} IS NULL`)
    .limit(1)

  if (legacy) {
    const [updated] = await db
      .update(income)
      .set({ amount, userId })
      .where(eq(income.id, legacy.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(income)
    .values({ month, amount, userId })
    .returning()

  return created
}
