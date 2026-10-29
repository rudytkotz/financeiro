import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { recurringTransactions, transactions, categories } from '../db/schema.js'
import type { RecurringTransaction } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'
import { assertAccountOwnership, assertDependentOwnership } from '../lib/ownership.js'

export type { ServiceError }

export interface CreateRecurringData {
  description: string
  amount: number
  kind?: 'despesa' | 'receita'
  categoryId?: string | null
  accountId?: string | null
  dependentId?: string | null
  paymentMethod?: string
  dayOfMonth: number
  startMonth: string
  endMonth?: string | null
}

export type UpdateRecurringData = Partial<CreateRecurringData> & { active?: boolean }

function validate(data: Partial<CreateRecurringData>) {
  if (data.description !== undefined && !data.description.trim()) {
    throw makeError(422, 'VALIDATION_ERROR', 'A descrição é obrigatória.')
  }
  if (data.amount !== undefined && (!Number.isInteger(data.amount) || data.amount <= 0)) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor deve ser maior que zero.')
  }
  if (data.dayOfMonth !== undefined && (!Number.isInteger(data.dayOfMonth) || data.dayOfMonth < 1 || data.dayOfMonth > 31)) {
    throw makeError(422, 'VALIDATION_ERROR', 'O dia do mês deve estar entre 1 e 31.')
  }
  if (data.startMonth !== undefined && !/^\d{4}-\d{2}$/.test(data.startMonth)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inicial inválido (YYYY-MM).')
  }
  if (data.endMonth && !/^\d{4}-\d{2}$/.test(data.endMonth)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês final inválido (YYYY-MM).')
  }
}

export async function listRecurring(userId: string): Promise<RecurringTransaction[]> {
  return db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.userId, userId))
    .orderBy(recurringTransactions.description)
}

export async function createRecurring(data: CreateRecurringData, userId: string): Promise<RecurringTransaction> {
  validate(data)
  if (!data.description?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'A descrição é obrigatória.')
  await assertCategoryOwnership(data.categoryId, userId)
  await assertAccountOwnership(data.accountId, userId)
  await assertDependentOwnership(data.dependentId, userId)

  const [created] = await db
    .insert(recurringTransactions)
    .values({
      description: data.description.trim(),
      amount: Math.abs(data.amount),
      kind: data.kind === 'receita' ? 'receita' : 'despesa',
      categoryId: data.categoryId ?? null,
      accountId: data.accountId ?? null,
      dependentId: data.dependentId ?? null,
      paymentMethod: data.paymentMethod ?? 'credito',
      dayOfMonth: data.dayOfMonth,
      startMonth: data.startMonth,
      endMonth: data.endMonth ?? null,
      userId,
    })
    .returning()
  return created
}

export async function updateRecurring(id: string, data: UpdateRecurringData, userId: string): Promise<RecurringTransaction> {
  validate(data)
  const [existing] = await db
    .select({ id: recurringTransactions.id })
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Recorrência não encontrada.')

  const updates: Record<string, unknown> = {}
  if (data.description !== undefined) updates.description = data.description.trim()
  if (data.amount !== undefined) updates.amount = Math.abs(data.amount)
  if (data.kind !== undefined) updates.kind = data.kind === 'receita' ? 'receita' : 'despesa'
  if (data.categoryId !== undefined) {
    await assertCategoryOwnership(data.categoryId, userId)
    updates.categoryId = data.categoryId
  }
  if (data.accountId !== undefined) {
    await assertAccountOwnership(data.accountId, userId)
    updates.accountId = data.accountId
  }
  if (data.dependentId !== undefined) {
    await assertDependentOwnership(data.dependentId, userId)
    updates.dependentId = data.dependentId
  }
  if (data.paymentMethod !== undefined) updates.paymentMethod = data.paymentMethod
  if (data.dayOfMonth !== undefined) updates.dayOfMonth = data.dayOfMonth
  if (data.startMonth !== undefined) updates.startMonth = data.startMonth
  if (data.endMonth !== undefined) updates.endMonth = data.endMonth
  if (data.active !== undefined) updates.active = data.active

  const [updated] = await db
    .update(recurringTransactions)
    .set(updates)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
    .returning()
  return updated
}

export async function deleteRecurring(id: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: recurringTransactions.id })
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Recorrência não encontrada.')

  // Desvincula as transações já geradas (mantém o histórico) e remove o modelo
  await db.transaction(async (tx) => {
    await tx.update(transactions).set({ recurringId: null })
      .where(and(eq(transactions.recurringId, id), eq(transactions.userId, userId)))
    await tx.delete(recurringTransactions)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
  })
}

// ---------------------------------------------------------------------------
// Materialização
// ---------------------------------------------------------------------------

function monthLte(a: string, b: string): boolean {
  return a <= b
}

function clampDay(year: number, month1to12: number, day: number): number {
  const lastDay = new Date(year, month1to12, 0).getDate()
  return Math.min(day, lastDay)
}

/**
 * Gera as transações do mês informado a partir dos modelos recorrentes ativos
 * cujo período de vigência inclui o mês. Idempotente: não duplica se a
 * ocorrência daquele modelo já existir no mês.
 *
 * Retorna quantas transações foram criadas.
 */
export async function materializeMonth(month: string, userId: string): Promise<number> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inválido. Formato esperado: YYYY-MM.')
  }

  const models = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, true)))

  // Filtra os modelos cujo período de vigência cobre o mês
  const applicable = models.filter((m) => {
    if (!monthLte(m.startMonth, month)) return false
    if (m.endMonth && !monthLte(month, m.endMonth)) return false
    return true
  })

  if (applicable.length === 0) return 0

  // Quais modelos já têm ocorrência neste mês?
  const existing = await db
    .select({ recurringId: transactions.recurringId })
    .from(transactions)
    .where(and(eq(transactions.referenceMonth, month), eq(transactions.userId, userId), sql`${transactions.recurringId} IS NOT NULL`))

  const alreadyMaterialized = new Set(existing.map((e) => e.recurringId))

  const [year, mon] = month.split('-').map(Number)
  const rows = applicable
    .filter((m) => !alreadyMaterialized.has(m.id))
    .map((m) => {
      const day = clampDay(year, mon, m.dayOfMonth)
      const date = `${month}-${String(day).padStart(2, '0')}`
      return {
        date,
        description: m.description,
        amount: m.amount,
        kind: m.kind,
        categoryId: m.categoryId,
        dependentId: m.dependentId,
        accountId: m.accountId,
        paymentMethod: m.paymentMethod,
        source: 'manual' as const,
        importId: null as string | null,
        referenceMonth: month,
        recurringId: m.id,
        userId,
      }
    })

  if (rows.length === 0) return 0

  await db.insert(transactions).values(rows)
  return rows.length
}

/**
 * Lista categorias do usuário (usado para validar ownership ao criar/editar).
 */
export async function assertCategoryOwnership(categoryId: string | null | undefined, userId: string): Promise<void> {
  if (!categoryId) return
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!cat) throw makeError(422, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
}
