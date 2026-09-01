import { eq, and, gte, lte, desc, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, imports } from '../db/schema.js'
import type { Transaction } from '../db/schema.js'

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
// Types
// ---------------------------------------------------------------------------

export interface ListTransactionsParams {
  month?: string        // YYYY-MM
  categoryId?: string
  startDate?: string    // YYYY-MM-DD
  endDate?: string      // YYYY-MM-DD
  sort?: 'amount_desc' | 'date_desc'
}

export interface ListTransactionsResult {
  transactions: Transaction[]
  total: number
}

export interface CreateTransactionData {
  date: string
  description: string
  amount: number
  categoryId: string
  operationType?: 'despesa' | 'reembolso'
  installmentTotal?: number  // 1 ou undefined = sem parcelamento; 2–24 = número de parcelas
}

export interface UpdateTransactionData {
  date?: string
  description?: string
  amount?: number
  categoryId?: string
  paymentMethod?: string
  operationType?: 'despesa' | 'reembolso'
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value)
}

function getMonthRange(month: string): { firstDay: string; lastDay: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null

  const year = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m < 1 || m > 12) return null

  const firstDay = `${month}-01`
  // Last day of month: go to next month day 0
  const lastDate = new Date(year, m, 0)
  const lastDay = `${year}-${String(m).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { firstDay, lastDay }
}

// ---------------------------------------------------------------------------
// TransactionService
// ---------------------------------------------------------------------------

/**
 * Lista transações com filtros opcionais e retorna o total (soma dos amounts).
 *
 * Filtros:
 *  - month (YYYY-MM): filtra entre primeiro e último dia do mês
 *  - categoryId: filtra por categoria
 *  - startDate/endDate: filtra por intervalo de datas (ambos devem ser fornecidos e startDate <= endDate)
 *  - sort: 'amount_desc' ordena por amount DESC; 'date_desc' (padrão) ordena por date DESC
 */
export async function listTransactions(params: ListTransactionsParams = {}, userId?: string): Promise<ListTransactionsResult> {
  const { month, categoryId, startDate, endDate, sort } = params
  const conditions: ReturnType<typeof eq>[] = []

  // Filter by user (include legacy transactions without userId)
  if (userId) {
    conditions.push(or(eq(transactions.userId, userId), sql`${transactions.userId} IS NULL`)!)
  }

  // Filtro por mês: usar referenceMonth diretamente
  if (month) {
    conditions.push(eq(transactions.referenceMonth, month))
  }

  // Filtro por categoria
  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId))
  }

  // Filtro por intervalo de datas
  if (startDate && endDate) {
    if (isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate) {
      conditions.push(gte(transactions.date, startDate))
      conditions.push(lte(transactions.date, endDate))
    }
    // Se startDate > endDate ou datas inválidas, ignora o filtro
  }

  // Determinar ordenação
  const orderBy = sort === 'amount_desc'
    ? desc(transactions.amount)
    : desc(transactions.date)

  // Construir a query com condições
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select()
    .from(transactions)
    .where(whereClause)
    .orderBy(orderBy)

  // Calcular total (soma dos amounts)
  const total = result.reduce((sum, t) => sum + t.amount, 0)

  return { transactions: result, total }
}

/**
 * Cria uma nova transação manual.
 *
 * Validações:
 *  - date: obrigatório, formato YYYY-MM-DD
 *  - description: obrigatório, máximo 255 caracteres
 *  - amount: obrigatório, diferente de zero, máx abs 999999999 centavos
 *    - positivo para despesas, negativo para reembolsos
 *  - operationType: opcional — 'despesa' (padrão) ou 'reembolso'
 *    - se 'reembolso', o amount é automaticamente negado (valor absoluto)
 *    - se 'despesa', o amount é sempre positivo
 *  - categoryId: obrigatório, deve existir no banco
 */
export async function createTransaction(data: CreateTransactionData, userId?: string): Promise<Transaction> {
  const { date, description, categoryId, operationType } = data
  let { amount } = data

  // Aplicar sinal baseado no tipo de operação
  if (operationType === 'reembolso') {
    // Reembolso: garantir que o valor seja negativo
    amount = -Math.abs(amount)
  } else {
    // Despesa (padrão): garantir que o valor seja positivo
    amount = Math.abs(amount)
  }

  // Validar date
  if (!date || !isValidDate(date)) {
    throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória e deve estar no formato YYYY-MM-DD.')
  }

  // Validar description
  const trimmedDesc = description?.trim() ?? ''
  if (!trimmedDesc) {
    throw makeError(422, 'VALIDATION_ERROR', 'A descrição é obrigatória.')
  }
  if (trimmedDesc.length > 255) {
    throw makeError(422, 'VALIDATION_ERROR', 'A descrição deve ter no máximo 255 caracteres.')
  }

  // Validar amount (após aplicar sinal)
  if (amount == null || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 999999999) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor deve ser um inteiro diferente de zero (máx R$ 9.999.999,99).')
  }

  // Validar categoryId
  if (!categoryId) {
    throw makeError(422, 'VALIDATION_ERROR', 'A categoria é obrigatória.')
  }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)

  if (!category) {
    throw makeError(422, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
  }

  // Validar installmentTotal (se fornecido)
  const parsedInstallments = data.installmentTotal ?? 1
  if (!Number.isInteger(parsedInstallments) || parsedInstallments < 1 || parsedInstallments > 24) {
    throw makeError(422, 'VALIDATION_ERROR', 'O número de parcelas deve ser entre 1 e 24.')
  }

  // Inserir transação (ou múltiplas parcelas)
  if (parsedInstallments === 1) {
    // Sem parcelamento — inserção simples
    const [created] = await db
      .insert(transactions)
      .values({
        date,
        description: trimmedDesc,
        amount,
        categoryId,
        dependentId: null,
        source: 'manual',
        importId: null,
        referenceMonth: date.substring(0, 7),
        userId: userId ?? null,
      })
      .returning()

    return created
  }

  // Com parcelamento — inserir N registros, um por mês
  // O valor de cada parcela é Math.round(total / N); a primeira parcela absorve o centavo residual
  const perInstallment = Math.floor(Math.abs(amount) / parsedInstallments)
  const remainder = Math.abs(amount) - perInstallment * parsedInstallments
  const signedPer = amount < 0 ? -perInstallment : perInstallment

  const [baseYear, baseMonth, baseDay] = date.split('-').map(Number)

  const rows = Array.from({ length: parsedInstallments }, (_, i) => {
    // Avança i meses a partir da data base
    const d = new Date(baseYear, baseMonth - 1 + i, 1)
    // Usa o mesmo dia da data original, ou o último dia do mês se ultrapassar
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const day = Math.min(baseDay, lastDay)
    const installDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const refMonth = installDate.substring(0, 7)

    // Primeira parcela recebe o centavo residual
    const installAmount = i === 0
      ? (amount < 0 ? -(perInstallment + remainder) : perInstallment + remainder)
      : signedPer

    return {
      date: installDate,
      description: trimmedDesc,
      amount: installAmount,
      categoryId,
      dependentId: null as string | null,
      source: 'manual' as const,
      importId: null as string | null,
      referenceMonth: refMonth,
      installmentCurrent: i + 1,
      installmentTotal: parsedInstallments,
      userId: userId ?? null,
    }
  })

  const created = await db
    .insert(transactions)
    .values(rows)
    .returning()

  // Retorna a primeira parcela como resposta principal
  return created[0]
}

/**
 * Atualiza uma transação existente.
 *
 * Mesmas validações do create aplicadas somente aos campos fornecidos.
 */
export async function updateTransaction(id: string, data: UpdateTransactionData): Promise<Transaction> {
  // Verificar se a transação existe
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)

  if (!existing) {
    throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')
  }

  const updates: Record<string, unknown> = {}

  // Validar date (se fornecido)
  if (data.date !== undefined) {
    if (!data.date || !isValidDate(data.date)) {
      throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória e deve estar no formato YYYY-MM-DD.')
    }
    updates.date = data.date
  }

  // Validar description (se fornecido)
  if (data.description !== undefined) {
    const trimmedDesc = data.description?.trim() ?? ''
    if (!trimmedDesc) {
      throw makeError(422, 'VALIDATION_ERROR', 'A descrição é obrigatória.')
    }
    if (trimmedDesc.length > 255) {
      throw makeError(422, 'VALIDATION_ERROR', 'A descrição deve ter no máximo 255 caracteres.')
    }
    updates.description = trimmedDesc
  }

  // Validar amount (se fornecido)
  if (data.amount !== undefined) {
    let amount = data.amount
    // Aplicar sinal baseado no tipo de operação (se fornecido junto com amount)
    if (data.operationType === 'reembolso') {
      amount = -Math.abs(amount)
    } else if (data.operationType === 'despesa') {
      amount = Math.abs(amount)
    }
    if (amount == null || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 999999999) {
      throw makeError(422, 'VALIDATION_ERROR', 'O valor deve ser um inteiro diferente de zero (máx R$ 9.999.999,99).')
    }
    updates.amount = amount
  } else if (data.operationType !== undefined && data.amount === undefined) {
    // operationType mudou mas amount não foi enviado: recalcular o sinal do amount existente
    const currentAmount = existing.amount
    if (data.operationType === 'reembolso') {
      updates.amount = -Math.abs(currentAmount)
    } else if (data.operationType === 'despesa') {
      updates.amount = Math.abs(currentAmount)
    }
  }

  // Validar categoryId (se fornecido)
  if (data.categoryId !== undefined) {
    if (data.categoryId === null || data.categoryId === '') {
      updates.categoryId = null
    } else {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, data.categoryId))
        .limit(1)

      if (!category) {
        throw makeError(422, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
      }
      updates.categoryId = data.categoryId
    }
  }

  // Validar paymentMethod (se fornecido)
  if (data.paymentMethod !== undefined) {
    const validMethods = ['credito', 'pix', 'debito', 'dinheiro', 'outros']
    if (!validMethods.includes(data.paymentMethod)) {
      throw makeError(422, 'VALIDATION_ERROR', 'Forma de pagamento inválida.')
    }
    updates.paymentMethod = data.paymentMethod
  }

  // Atualizar com updatedAt
  updates.updatedAt = new Date()

  const [updated] = await db
    .update(transactions)
    .set(updates)
    .where(eq(transactions.id, id))
    .returning()

  // Propagar categoryId e dependentId para todas as parcelas da mesma compra
  if (existing.installmentTotal && existing.installmentTotal > 1) {
    const propagateUpdates: Record<string, unknown> = {}
    if (data.categoryId !== undefined) propagateUpdates.categoryId = data.categoryId
    if ((data as any).dependentId !== undefined) propagateUpdates.dependentId = (data as any).dependentId

    if (Object.keys(propagateUpdates).length > 0) {
      propagateUpdates.updatedAt = new Date()
      await db
        .update(transactions)
        .set(propagateUpdates)
        .where(
          sql`${transactions.id} != ${id}
            AND ${transactions.description} = ${existing.description}
            AND ${transactions.amount} = ${existing.amount}
            AND ${transactions.installmentTotal} = ${existing.installmentTotal}`
        )
    }
  }

  return updated
}

/**
 * Remove uma transação por id.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)

  if (!existing) {
    throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')
  }

  await db.delete(transactions).where(eq(transactions.id, id))
}

/**
 * Remove todas as transações de um determinado mês (YYYY-MM).
 * Inclui transações com date naquele mês E transações vinculadas a importações daquele mês.
 */
export async function deleteAllByMonth(month: string, userId?: string): Promise<number> {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inválido. Formato esperado: YYYY-MM.')
  }

  const conditions = [eq(transactions.referenceMonth, month)]
  if (userId) conditions.push(or(eq(transactions.userId, userId), sql`${transactions.userId} IS NULL`)!)

  const finalFilter = conditions.length > 1 ? and(...conditions)! : conditions[0]

  const result = await db
    .delete(transactions)
    .where(finalFilter)
    .returning({ id: transactions.id })

  // Also delete the import records for that month + user
  if (userId) {
    await db.delete(imports).where(and(eq(imports.referenceMonth, month), or(eq(imports.userId, userId), sql`${imports.userId} IS NULL`)!))
  } else {
    await db.delete(imports).where(eq(imports.referenceMonth, month))
  }

  return result.length
}

// ---------------------------------------------------------------------------
// Dependent association
// ---------------------------------------------------------------------------

export interface AssociateDependentData {
  dependentId: string | null
  force?: boolean
}

export interface AssociateDependentConflict {
  code: 'REQUIRES_CONFIRMATION'
  requiresConfirmation: true
  message: string
}

/**
 * Associa ou desassocia um dependente a uma transação.
 *
 * Regras:
 *  - Se dependentId = null → desassocia (set dependent_id = null)
 *  - Se a transação já tem dependente diferente do novo e force !== true → retorna conflito (409)
 *  - Se force = true ou transação sem dependente → associa
 *  - dependentId deve referenciar um dependente existente (422 se não)
 */
export async function associateDependent(
  id: string,
  data: AssociateDependentData,
  userId?: string
): Promise<{ transaction: Transaction } | { conflict: AssociateDependentConflict }> {
  const { dependentId, force } = data

  // Buscar a transação
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)

  if (!existing) {
    throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')
  }

  // Desassociar
  if (dependentId === null) {
    const [updated] = await db
      .update(transactions)
      .set({ dependentId: null, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning()

    // Propagar para todas as parcelas da mesma compra
    if (existing.installmentTotal && existing.installmentTotal > 1) {
      await db
        .update(transactions)
        .set({ dependentId: null, updatedAt: new Date() })
        .where(
          sql`${transactions.id} != ${id}
            AND ${transactions.description} = ${existing.description}
            AND ${transactions.amount} = ${existing.amount}
            AND ${transactions.installmentTotal} = ${existing.installmentTotal}`
        )
    }

    return { transaction: updated }
  }

  // Verificar se o dependente existe E pertence ao usuário
  const dependentConditions = [eq(dependents.id, dependentId)]
  if (userId) {
    dependentConditions.push(or(eq(dependents.userId, userId), sql`${dependents.userId} IS NULL`)!)
  }
  const [dependent] = await db
    .select({ id: dependents.id })
    .from(dependents)
    .where(and(...dependentConditions))
    .limit(1)

  if (!dependent) {
    throw makeError(422, 'DEPENDENT_NOT_FOUND', 'Dependente não encontrado.')
  }

  // Verificar conflito: transação já tem dependente diferente
  if (existing.dependentId && existing.dependentId !== dependentId && !force) {
    return {
      conflict: {
        code: 'REQUIRES_CONFIRMATION',
        requiresConfirmation: true,
        message: 'Esta transação já está associada a outro dependente. Deseja substituir a associação?',
      },
    }
  }

  // Associar
  const [updated] = await db
    .update(transactions)
    .set({ dependentId, updatedAt: new Date() })
    .where(eq(transactions.id, id))
    .returning()

  // Propagar para todas as parcelas da mesma compra
  if (existing.installmentTotal && existing.installmentTotal > 1) {
    await db
      .update(transactions)
      .set({ dependentId, updatedAt: new Date() })
      .where(
        sql`${transactions.id} != ${id}
          AND ${transactions.description} = ${existing.description}
          AND ${transactions.amount} = ${existing.amount}
          AND ${transactions.installmentTotal} = ${existing.installmentTotal}`
      )
  }

  return { transaction: updated }
}
