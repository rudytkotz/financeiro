import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { income } from '../db/schema.js'
import type { Income } from '../db/schema.js'

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

// ---------------------------------------------------------------------------
// IncomeService
// ---------------------------------------------------------------------------

/**
 * Retorna o registro de renda para o mês informado ou null se não existir.
 */
export async function getIncome(month: string): Promise<Income | null> {
  const [record] = await db
    .select()
    .from(income)
    .where(eq(income.month, month))
    .limit(1)

  return record ?? null
}

/**
 * Cria ou substitui a renda do mês (upsert via ON CONFLICT).
 *
 * Validações:
 *  - amount deve estar entre 1 e 99_999_999_999 centavos
 *    (R$ 0,01 a R$ 999.999.999,99) → 422 VALIDATION_ERROR
 */
export async function setIncome(month: string, amount: number): Promise<Income> {
  // 422 — validação do valor
  if (!Number.isInteger(amount) || amount < 1 || amount > 99_999_999_999) {
    throw makeError(
      422,
      'VALIDATION_ERROR',
      'O valor da renda deve ser um inteiro entre 1 e 99999999999 centavos (R$ 0,01 a R$ 999.999.999,99).'
    )
  }

  const [record] = await db
    .insert(income)
    .values({ month, amount })
    .onConflictDoUpdate({ target: income.month, set: { amount } })
    .returning()

  return record
}
