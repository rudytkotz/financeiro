import { eq, desc, sql, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { imports, transactions, dependents } from '../db/schema.js'
import type { Import } from '../db/schema.js'

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

export interface ImportTransaction {
  date: string // YYYY-MM-DD
  description: string
  amount: number // centavos, positivo
  categoryId: string
  dependentId?: string | null
  portador?: string | null
  installmentCurrent?: number | null
  installmentTotal?: number | null
}

// ---------------------------------------------------------------------------
// ImportService
// ---------------------------------------------------------------------------

/**
 * Resolve portador names to dependent IDs.
 * Se não existe, cria automaticamente.
 * Usa UMA query para buscar todos de uma vez em vez de N queries.
 */
export async function resolvePortadorToDependents(
  portadorNames: string[],
  userId?: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (portadorNames.length === 0) return result

  // Deduplicate (case-insensitive)
  const uniqueNames = [...new Set(portadorNames.map((n) => n.trim()).filter(Boolean))]
  const uniqueNamesLower = uniqueNames.map(n => n.toLowerCase())

  // Buscar todos de uma vez com uma única query
  const existing = await db
    .select({ id: dependents.id, name: dependents.name })
    .from(dependents)
    .where(
      userId
        ? sql`lower(${dependents.name}) = ANY(${uniqueNamesLower}) AND ${dependents.userId} = ${userId}`
        : sql`lower(${dependents.name}) = ANY(${uniqueNamesLower}) AND ${dependents.userId} IS NULL`
    )

  // Mapear os encontrados
  for (const dep of existing) {
    result.set(dep.name.toLowerCase(), dep.id)
  }

  // Criar apenas os que não existem (normalmente poucos ou nenhum)
  const toCreate = uniqueNames.filter(n => !result.has(n.toLowerCase()))
  for (const name of toCreate) {
    const [created] = await db
      .insert(dependents)
      .values({ name, userId: userId ?? null })
      .returning()
    result.set(name.toLowerCase(), created.id)
  }

  return result
}

/**
 * Determina o mês de referência de um conjunto de transações como o mês
 * da data mais antiga (YYYY-MM).
 */
export function calculateReferenceMonth(transactionList: Pick<ImportTransaction, 'date'>[]): string {
  if (transactionList.length === 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'Nenhuma transação fornecida para calcular o mês de referência.')
  }

  let oldest = transactionList[0].date
  for (let i = 1; i < transactionList.length; i++) {
    if (transactionList[i].date < oldest) {
      oldest = transactionList[i].date
    }
  }

  // oldest is YYYY-MM-DD, extract YYYY-MM
  return oldest.substring(0, 7)
}

/**
 * Verifica se já existe um registro na tabela `imports` com o mês de referência
 * informado. Retorna `true` se duplicado, `false` caso contrário.
 */
export async function checkDuplicate(referenceMonth: string, userId?: string): Promise<boolean> {
  const conditions = [eq(imports.referenceMonth, referenceMonth)]
  if (userId) conditions.push(eq(imports.userId, userId))

  const [existing] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(conditions.length > 1 ? sql`${imports.referenceMonth} = ${referenceMonth} AND ${imports.userId} = ${userId}` : eq(imports.referenceMonth, referenceMonth))
    .limit(1)

  return !!existing
}

/**
 * Persiste uma importação com suas transações dentro de uma transação SQL.
 *
 * - Usa o reference_month fornecido ou calcula a partir das transações
 * - Insere registro em `imports` com importedAt = now e transactionCount
 * - Insere todas as transações em batch com source = 'csv' e importId vinculado
 *
 * Retorna o registro de importação criado.
 */
export async function saveImport(transactionList: ImportTransaction[], explicitReferenceMonth?: string, userId?: string): Promise<Import> {
  if (transactionList.length === 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'Nenhuma transação fornecida para importação.')
  }

  const referenceMonth = explicitReferenceMonth || calculateReferenceMonth(transactionList)

  const result = await db.transaction(async (tx) => {
    // Inserir registro de importação
    const [importRecord] = await tx
      .insert(imports)
      .values({
        referenceMonth,
        importedAt: new Date(),
        transactionCount: transactionList.length,
        userId: userId ?? null,
      })
      .returning()

    // Inserir transações em batch
    await tx.insert(transactions).values(
      transactionList.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryId: null, // categoria definida pelo usuario
        dependentId: t.dependentId ?? null,
        portador: t.portador ?? null,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        source: 'csv' as const,
        importId: importRecord.id,
        referenceMonth,
        userId: userId ?? null,
      }))
    )

    return importRecord
  })

  return result
}

/**
 * Sobrescreve uma importação existente para um determinado mês de referência.
 *
 * - Deleta as transações vinculadas à importação anterior
 * - Deleta o registro de importação anterior
 * - Executa saveImport com os novos dados
 *
 * Tudo dentro de uma transação SQL.
 */
export async function overwriteImport(
  referenceMonth: string,
  transactionList: ImportTransaction[],
  userId?: string
): Promise<Import> {
  if (transactionList.length === 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'Nenhuma transação fornecida para importação.')
  }

  const result = await db.transaction(async (tx) => {
    // Encontrar importação anterior filtrando por userId
    const [existingImport] = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(
        userId
          ? and(eq(imports.referenceMonth, referenceMonth), eq(imports.userId, userId))
          : eq(imports.referenceMonth, referenceMonth)
      )
      .limit(1)

    // Mapa de categorização prévia: lower(description) -> { categoryId, dependentId }
    type CategorizationEntry = { categoryId: string | null; dependentId: string | null }
    const categorizationMap = new Map<string, CategorizationEntry>()

    if (existingImport) {
      // Buscar transações antigas que possuem categoryId ou dependentId preenchido
      const oldTransactions = await tx
        .select({
          description: transactions.description,
          categoryId: transactions.categoryId,
          dependentId: transactions.dependentId,
        })
        .from(transactions)
        .where(
          sql`${transactions.importId} = ${existingImport.id}
            AND (${transactions.categoryId} IS NOT NULL OR ${transactions.dependentId} IS NOT NULL)`
        )

      // Criar mapa: lower(description) -> { categoryId, dependentId }
      for (const t of oldTransactions) {
        const key = t.description.toLowerCase()
        if (!categorizationMap.has(key)) {
          categorizationMap.set(key, {
            categoryId: t.categoryId,
            dependentId: t.dependentId,
          })
        }
      }

      // Deletar transações vinculadas à importação anterior
      await tx
        .delete(transactions)
        .where(eq(transactions.importId, existingImport.id))

      // Deletar o registro de importação anterior
      await tx.delete(imports).where(eq(imports.id, existingImport.id))
    }

    // Inserir novo registro de importação
    const [importRecord] = await tx
      .insert(imports)
      .values({
        referenceMonth,
        importedAt: new Date(),
        transactionCount: transactionList.length,
        userId: userId ?? null,
      })
      .returning()

    // Inserir novas transações em batch
    const insertedTransactions = await tx.insert(transactions).values(
      transactionList.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryId: null as string | null,
        dependentId: t.dependentId ?? null,
        portador: t.portador ?? null,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        source: 'csv' as const,
        importId: importRecord.id,
        referenceMonth,
        userId: userId ?? null,
      }))
    ).returning()

    // Reaplicar categorizações em batch: um único UPDATE por categoria única
    // em vez de N updates individuais
    if (categorizationMap.size > 0) {
      // Agrupar transações inseridas por chave de categorização
      type BatchUpdate = { ids: string[]; categoryId: string | null; dependentId: string | null }
      const batchMap = new Map<string, BatchUpdate>()

      for (const inserted of insertedTransactions) {
        const entry = categorizationMap.get(inserted.description.toLowerCase())
        if (entry && (entry.categoryId || entry.dependentId)) {
          const key = `${entry.categoryId ?? ''}|${entry.dependentId ?? ''}`
          if (!batchMap.has(key)) {
            batchMap.set(key, { ids: [], categoryId: entry.categoryId, dependentId: entry.dependentId })
          }
          batchMap.get(key)!.ids.push(inserted.id)
        }
      }

      // Um UPDATE por grupo de categorização única
      for (const { ids, categoryId, dependentId } of batchMap.values()) {
        const reapply: Record<string, unknown> = { updatedAt: new Date() }
        if (categoryId) reapply.categoryId = categoryId
        if (dependentId) reapply.dependentId = dependentId
        await tx
          .update(transactions)
          .set(reapply)
          .where(inArray(transactions.id, ids))
      }
    }

    return importRecord
  })

  return result
}


/**
 * Retorna a lista de importações do usuário, ordenadas pela data de
 * importação mais recente primeiro.
 */
export async function listImports(userId?: string): Promise<Import[]> {
  return db
    .select()
    .from(imports)
    .where(userId ? eq(imports.userId, userId) : undefined)
    .orderBy(desc(imports.importedAt))
}

/**
 * Insere transações avulsas (sem importId) diretamente no banco.
 * Usado para parcelas expandidas que pertencem a outros meses.
 * Antes de inserir, verifica duplicatas por (date, description, amount, installmentCurrent, installmentTotal).
 */
export async function insertStandaloneTransactions(transactionList: ImportTransaction[], userId?: string): Promise<void> {
  if (transactionList.length === 0) return

  const toInsert = await filterDuplicateInstallments(transactionList, userId)
  if (toInsert.length === 0) return

  await db.insert(transactions).values(
    toInsert.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      categoryId: null, // categoria definida pelo usuario
      dependentId: t.dependentId ?? null,
      portador: t.portador ?? null,
      installmentCurrent: t.installmentCurrent ?? null,
      installmentTotal: t.installmentTotal ?? null,
      source: 'csv' as const,
      importId: null,
      referenceMonth: t.date.substring(0, 7), // derive month from date (YYYY-MM-01)
      userId: userId ?? null,
    }))
  )
}

/**
 * Filtra transações que já existem no banco com mesma combinação de
 * date + description + amount + installmentCurrent + installmentTotal + userId.
 *
 * Em vez de N queries (uma por transação), faz UMA query trazendo todos os
 * registros existentes para o usuário e mês relevantes, depois filtra em memória.
 * Isso elimina o N+1 e reduz o tempo de 65 queries para 1.
 */
export async function filterDuplicateInstallments(transactionList: ImportTransaction[], userId?: string): Promise<ImportTransaction[]> {
  // Separar parceladas das não-parceladas — não-parceladas nunca são filtradas
  const installmented = transactionList.filter(t => t.installmentCurrent && t.installmentTotal)
  const nonInstallmented = transactionList.filter(t => !t.installmentCurrent || !t.installmentTotal)

  if (installmented.length === 0) return transactionList

  // Buscar todas as parcelas existentes do usuário de uma vez só
  // usando as datas como filtro para reduzir o resultado
  const uniqueDates = [...new Set(installmented.map(t => t.date))]

  const userCondition = userId
    ? sql`${transactions.userId} = ${userId}`
    : sql`${transactions.userId} IS NULL`

  const existingRows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.date, uniqueDates),
        userCondition,
        sql`${transactions.installmentCurrent} IS NOT NULL`
      )
    )

  // Criar um Set de chaves para lookup O(1)
  const existingSet = new Set(
    existingRows.map(r =>
      `${r.date}|${r.description}|${r.amount}|${r.installmentCurrent}|${r.installmentTotal}`
    )
  )

  const filteredInstallmented = installmented.filter(t => {
    const key = `${t.date}|${t.description}|${t.amount}|${t.installmentCurrent}|${t.installmentTotal}`
    return !existingSet.has(key)
  })

  return [...nonInstallmented, ...filteredInstallmented]
}
