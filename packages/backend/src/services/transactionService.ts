import { eq, and, gte, lte, desc, or, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, imports } from '../db/schema.js'
import type { Transaction } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'
import { assertAccountOwnership, assertDependentOwnership } from '../lib/ownership.js'

export type { ServiceError }

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
  dependentId?: string | null
  accountId?: string | null
  operationType?: 'despesa' | 'reembolso'
  kind?: 'despesa' | 'receita'  // receita = entrada de dinheiro
  installmentTotal?: number  // 1 ou undefined = sem parcelamento; 2–24 = número de parcelas
  paymentMethod?: string
  tags?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
}

export interface UpdateTransactionData {
  date?: string
  description?: string
  amount?: number
  categoryId?: string | null
  dependentId?: string | null
  accountId?: string | null
  paymentMethod?: string
  operationType?: 'despesa' | 'reembolso'
  tags?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
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

  // Filtra estritamente pelas transações do usuário (isolamento total)
  if (userId) {
    conditions.push(eq(transactions.userId, userId))
  }

  // Oculta transações na lixeira (soft delete)
  conditions.push(isNull(transactions.deletedAt))

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
  const { date, description, categoryId, operationType, paymentMethod } = data
  const kind = data.kind === 'receita' ? 'receita' : 'despesa'
  let { amount } = data
  // Aplicar sinal baseado no tipo de operação
  if (kind === 'receita') {
    // Receita: valor sempre positivo (representa entrada)
    amount = Math.abs(amount)
  } else if (operationType === 'reembolso') {
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
    .where(userId ? and(eq(categories.id, categoryId), eq(categories.userId, userId)) : eq(categories.id, categoryId))
    .limit(1)

  if (!category) {
    throw makeError(422, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
  }

  // Garantir que conta e dependente (se informados) pertencem ao usuário
  if (userId) {
    await assertAccountOwnership(data.accountId, userId)
    await assertDependentOwnership(data.dependentId, userId)
  }

  // Validar installmentTotal (se fornecido). Receita é sempre à vista.
  const parsedInstallments = kind === 'receita' ? 1 : (data.installmentTotal ?? 1)
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
        dependentId: data.dependentId ?? null,
        accountId: data.accountId ?? null,
        kind,
        source: 'manual',
        importId: null,
        referenceMonth: date.substring(0, 7),
        paymentMethod: paymentMethod ?? 'credito',
        tags: data.tags ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        attachmentName: data.attachmentName ?? null,
        userId: userId ?? null,
      })
      .returning()

    return created
  }

  // Com parcelamento — inserir N registros, um por mês
  const perInstallment = Math.floor(Math.abs(amount) / parsedInstallments)
  const remainder = Math.abs(amount) - perInstallment * parsedInstallments
  const signedPer = amount < 0 ? -perInstallment : perInstallment

  const [baseYear, baseMonth, baseDay] = date.split('-').map(Number)

  const rows = Array.from({ length: parsedInstallments }, (_, i) => {
    const d = new Date(baseYear, baseMonth - 1 + i, 1)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const day = Math.min(baseDay, lastDay)
    const installDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const refMonth = installDate.substring(0, 7)

    const installAmount = i === 0
      ? (amount < 0 ? -(perInstallment + remainder) : perInstallment + remainder)
      : signedPer

    return {
      date: installDate,
      description: trimmedDesc,
      amount: installAmount,
      categoryId,
      dependentId: data.dependentId ?? null as string | null,
      accountId: data.accountId ?? null as string | null,
      source: 'manual' as const,
      importId: null as string | null,
      referenceMonth: refMonth,
      installmentCurrent: i + 1,
      installmentTotal: parsedInstallments,
      paymentMethod: paymentMethod ?? 'credito',
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
 * Verifica que a transação pertence ao userId antes de atualizar.
 */
export async function updateTransaction(id: string, data: UpdateTransactionData, userId?: string): Promise<Transaction> {
  // Verificar se a transação existe e pertence ao usuário
  const whereClause = userId
    ? and(eq(transactions.id, id), eq(transactions.userId, userId))
    : eq(transactions.id, id)

  const [existing] = await db
    .select()
    .from(transactions)
    .where(whereClause)
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
        .where(userId ? and(eq(categories.id, data.categoryId), eq(categories.userId, userId)) : eq(categories.id, data.categoryId))
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

  // dependentId (se fornecido) — valida ownership
  if (data.dependentId !== undefined) {
    if (userId) await assertDependentOwnership(data.dependentId, userId)
    updates.dependentId = data.dependentId
  }

  // accountId (se fornecido) — valida ownership
  if (data.accountId !== undefined) {
    if (userId) await assertAccountOwnership(data.accountId, userId)
    updates.accountId = data.accountId
  }

  // tags e anexo (se fornecidos)
  if (data.tags !== undefined) updates.tags = data.tags
  if (data.attachmentUrl !== undefined) updates.attachmentUrl = data.attachmentUrl
  if (data.attachmentName !== undefined) updates.attachmentName = data.attachmentName

  // Atualizar com updatedAt
  updates.updatedAt = new Date()

  const [updated] = await db
    .update(transactions)
    .set(updates)
    .where(userId
      ? and(eq(transactions.id, id), eq(transactions.userId, userId))
      : eq(transactions.id, id))
    .returning()

  // Propagar categoryId e dependentId para todas as parcelas da mesma compra
  if (existing.installmentTotal && existing.installmentTotal > 1) {
    const propagateUpdates: Record<string, unknown> = {}
    if (data.categoryId !== undefined) propagateUpdates.categoryId = data.categoryId
    if (data.dependentId !== undefined) propagateUpdates.dependentId = data.dependentId

    if (Object.keys(propagateUpdates).length > 0) {
      propagateUpdates.updatedAt = new Date()

      if (existing.importId !== null) {
        // Transações importadas: propagar por importId + installmentTotal
        await db
          .update(transactions)
          .set(propagateUpdates)
          .where(
            and(
              sql`${transactions.id} != ${id}`,
              eq(transactions.importId, existing.importId),
              eq(transactions.installmentTotal, existing.installmentTotal)
            )
          )
      } else {
        // Transações manuais: propagar por description + installmentTotal + userId
        // NÃO usa amount pois cada parcela pode ter valor diferente (arredondamento)
        await db
          .update(transactions)
          .set(propagateUpdates)
          .where(
            and(
              sql`${transactions.id} != ${id}`,
              eq(transactions.description, existing.description),
              eq(transactions.installmentTotal, existing.installmentTotal),
              userId ? eq(transactions.userId, userId) : sql`1=1`
            )
          )
      }
    }
  }

  return updated
}

/**
 * Remove uma transação por id.
 * Verifica que a transação pertence ao userId antes de deletar.
 */
export async function deleteTransaction(id: string, userId?: string): Promise<void> {
  const whereClause = userId
    ? and(eq(transactions.id, id), eq(transactions.userId, userId))
    : eq(transactions.id, id)

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(whereClause)
    .limit(1)

  if (!existing) {
    throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')
  }

  // Soft delete: marca como excluída (vai para a lixeira), não apaga de fato
  await db.update(transactions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(userId ? and(eq(transactions.id, id), eq(transactions.userId, userId)) : eq(transactions.id, id))
}

/**
 * Lista as transações na lixeira (soft-deleted) do usuário.
 */
export async function listDeletedTransactions(userId: string): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.deletedAt} IS NOT NULL`))
    .orderBy(desc(transactions.deletedAt))
}

/**
 * Restaura uma transação da lixeira.
 */
export async function restoreTransaction(id: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')

  await db.update(transactions)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
}

/**
 * Exclui permanentemente uma transação da lixeira.
 */
export async function purgeTransaction(id: string, userId: string): Promise<void> {
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
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
  if (userId) conditions.push(eq(transactions.userId, userId))

  const finalFilter = conditions.length > 1 ? and(...conditions)! : conditions[0]

  const result = await db
    .delete(transactions)
    .where(finalFilter)
    .returning({ id: transactions.id })

  // Also delete the import records for that month + user
  if (userId) {
    await db.delete(imports).where(and(eq(imports.referenceMonth, month), eq(imports.userId, userId)))
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

  // Buscar a transação (restrita ao usuário)
  const txWhere = userId
    ? and(eq(transactions.id, id), eq(transactions.userId, userId))
    : eq(transactions.id, id)

  const [existing] = await db
    .select()
    .from(transactions)
    .where(txWhere)
    .limit(1)

  if (!existing) {
    throw makeError(404, 'NOT_FOUND', 'Transação não encontrada.')
  }

  // Desassociar
  if (dependentId === null) {
    const [updated] = await db
      .update(transactions)
      .set({ dependentId: null, updatedAt: new Date() })
      .where(userId ? and(eq(transactions.id, id), eq(transactions.userId, userId)) : eq(transactions.id, id))
      .returning()

    // Propagar para todas as parcelas da mesma compra
    if (existing.installmentTotal && existing.installmentTotal > 1) {
      if (existing.importId !== null) {
        await db
          .update(transactions)
          .set({ dependentId: null, updatedAt: new Date() })
          .where(
            and(
              sql`${transactions.id} != ${id}`,
              eq(transactions.importId, existing.importId),
              eq(transactions.installmentTotal, existing.installmentTotal)
            )
          )
      } else {
        await db
          .update(transactions)
          .set({ dependentId: null, updatedAt: new Date() })
          .where(
            and(
              sql`${transactions.id} != ${id}`,
              eq(transactions.description, existing.description),
              eq(transactions.installmentTotal, existing.installmentTotal),
              userId ? eq(transactions.userId, userId) : sql`1=1`
            )
          )
      }
    }

    return { transaction: updated }
  }

  // Verificar se o dependente existe E pertence ao usuário
  const dependentConditions = [eq(dependents.id, dependentId)]
  if (userId) {
    dependentConditions.push(eq(dependents.userId, userId))
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
    .where(userId ? and(eq(transactions.id, id), eq(transactions.userId, userId)) : eq(transactions.id, id))
    .returning()

  // Propagar para todas as parcelas da mesma compra
  if (existing.installmentTotal && existing.installmentTotal > 1) {
    if (existing.importId !== null) {
      await db
        .update(transactions)
        .set({ dependentId, updatedAt: new Date() })
        .where(
          and(
            sql`${transactions.id} != ${id}`,
            eq(transactions.importId, existing.importId),
            eq(transactions.installmentTotal, existing.installmentTotal)
          )
        )
    } else {
      await db
        .update(transactions)
        .set({ dependentId, updatedAt: new Date() })
        .where(
          and(
            sql`${transactions.id} != ${id}`,
            eq(transactions.description, existing.description),
            eq(transactions.installmentTotal, existing.installmentTotal),
            userId ? eq(transactions.userId, userId) : sql`1=1`
          )
        )
    }
  }

  return { transaction: updated }
}

// ---------------------------------------------------------------------------
// Transferências entre contas
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import { accounts as accountsTable } from '../db/schema.js'

export interface CreateTransferData {
  fromAccountId: string
  toAccountId: string
  amount: number        // centavos, positivo
  date: string          // YYYY-MM-DD
  description?: string
}

export interface TransferResult {
  transferId: string
  from: Transaction
  to: Transaction
}

/**
 * Cria uma transferência entre duas contas do usuário.
 *
 * Gera duas transações pareadas por transferId e marcadas com kind 'transfer':
 *  - Saída na conta de origem (amount positivo → reduz o saldo da origem)
 *  - Entrada na conta de destino (amount negativo → aumenta o saldo do destino)
 *
 * O kind 'transfer' mantém esses lançamentos fora dos totais de despesas e
 * receitas nos relatórios (que somam apenas 'despesa' e 'receita').
 */
export async function createTransfer(data: CreateTransferData, userId: string): Promise<TransferResult> {
  const { fromAccountId, toAccountId } = data

  if (!fromAccountId || !toAccountId) {
    throw makeError(422, 'VALIDATION_ERROR', 'Informe a conta de origem e a de destino.')
  }
  if (fromAccountId === toAccountId) {
    throw makeError(422, 'VALIDATION_ERROR', 'A origem e o destino devem ser contas diferentes.')
  }
  if (!data.date || !isValidDate(data.date)) {
    throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória e deve estar no formato YYYY-MM-DD.')
  }
  const amount = Math.abs(data.amount)
  if (!Number.isInteger(amount) || amount === 0 || amount > 999999999) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor deve ser um inteiro positivo (máx R$ 9.999.999,99).')
  }

  // Valida que ambas as contas pertencem ao usuário
  const owned = await db
    .select({ id: accountsTable.id, name: accountsTable.name })
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), or(eq(accountsTable.id, fromAccountId), eq(accountsTable.id, toAccountId))!))

  const fromAcc = owned.find((a) => a.id === fromAccountId)
  const toAcc = owned.find((a) => a.id === toAccountId)
  if (!fromAcc || !toAcc) {
    throw makeError(404, 'NOT_FOUND', 'Conta de origem ou destino não encontrada.')
  }

  const transferId = randomUUID()
  const refMonth = data.date.substring(0, 7)
  const baseDesc = data.description?.trim() || 'Transferência'

  const result = await db.transaction(async (tx) => {
    const [from] = await tx
      .insert(transactions)
      .values({
        date: data.date,
        description: `${baseDesc} → ${toAcc.name}`,
        amount, // positivo: sai da origem (reduz saldo)
        categoryId: null,
        accountId: fromAccountId,
        transferId,
        kind: 'transfer',
        source: 'manual',
        referenceMonth: refMonth,
        paymentMethod: 'outros',
        userId,
      })
      .returning()

    const [to] = await tx
      .insert(transactions)
      .values({
        date: data.date,
        description: `${baseDesc} ← ${fromAcc.name}`,
        amount: -amount, // negativo: entra no destino (aumenta saldo)
        categoryId: null,
        accountId: toAccountId,
        transferId,
        kind: 'transfer',
        source: 'manual',
        referenceMonth: refMonth,
        paymentMethod: 'outros',
        userId,
      })
      .returning()

    return { from, to }
  })

  return { transferId, from: result.from, to: result.to }
}

/**
 * Remove uma transferência (as duas pontas) pelo transferId.
 */
export async function deleteTransfer(transferId: string, userId: string): Promise<void> {
  const legs = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.transferId, transferId), eq(transactions.userId, userId)))

  if (legs.length === 0) {
    throw makeError(404, 'NOT_FOUND', 'Transferência não encontrada.')
  }

  await db.delete(transactions).where(and(eq(transactions.transferId, transferId), eq(transactions.userId, userId)))
}
