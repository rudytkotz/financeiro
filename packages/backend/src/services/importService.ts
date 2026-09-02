import { eq, desc, sql } from 'drizzle-orm'
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
 * If a portador name does not match an existing dependent (case-insensitive),
 * creates a new dependent automatically.
 * Returns a map of lowercase portador name → dependent ID.
 */
export async function resolvePortadorToDependents(
  portadorNames: string[],
  userId?: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (portadorNames.length === 0) return result

  // Deduplicate (case-insensitive)
  const uniqueNames = [...new Set(portadorNames.map((n) => n.trim()).filter(Boolean))]

  for (const name of uniqueNames) {
    // Check if dependent already exists for this user (case-insensitive)
    const [existing] = await db
      .select({ id: dependents.id, name: dependents.name })
      .from(dependents)
      .where(
        userId
          ? sql`lower(${dependents.name}) = lower(${name}) AND ${dependents.userId} = ${userId}`
          : sql`lower(${dependents.name}) = lower(${name}) AND ${dependents.userId} IS NULL`
      )
      .limit(1)

    if (existing) {
      result.set(name.toLowerCase(), existing.id)
    } else {
      // Auto-create dependent with userId
      const [created] = await db
        .insert(dependents)
        .values({ name, userId: userId ?? null })
        .returning()
      result.set(name.toLowerCase(), created.id)
    }
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
    // Encontrar importação anterior
    const [existingImport] = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(eq(imports.referenceMonth, referenceMonth))
      .limit(1)

    if (existingImport) {
      // Deletar transações vinculadas à importação anterior
      await tx
        .delete(transactions)
        .where(eq(transactions.importId, existingImport.id))

      // Deletar o registro de importação anterior
      await tx.delete(imports).where(eq(imports.id, existingImport.id))
    }

    // Calcular o novo reference_month a partir das transações
    const newReferenceMonth = referenceMonth

    // Inserir novo registro de importação
    const [importRecord] = await tx
      .insert(imports)
      .values({
        referenceMonth: newReferenceMonth,
        importedAt: new Date(),
        transactionCount: transactionList.length,
        userId: userId ?? null,
      })
      .returning()

    // Inserir novas transações em batch
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
        referenceMonth: newReferenceMonth,
        userId: userId ?? null,
      }))
    )

    return importRecord
  })

  return result
}


/**
 * Retorna a lista de todas as importações anteriores, ordenadas pela data de
 * importação mais recente primeiro.
 */
export async function listImports(): Promise<Import[]> {
  return db
    .select()
    .from(imports)
    .orderBy(desc(imports.importedAt))
}

/**
 * Insere transações avulsas (sem importId) diretamente no banco.
 * Usado para parcelas expandidas que pertencem a outros meses.
 * Antes de inserir, verifica duplicatas por (date, description, amount, installmentCurrent, installmentTotal).
 */
export async function insertStandaloneTransactions(transactionList: ImportTransaction[], userId?: string): Promise<void> {
  if (transactionList.length === 0) return

  const toInsert = await filterDuplicateInstallments(transactionList)
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
 * date + description + amount + installmentCurrent + installmentTotal.
 * Retorna apenas as que NÃO são duplicatas.
 * Transações sem parcela (installmentCurrent == null) nunca são filtradas.
 */
export async function filterDuplicateInstallments(transactionList: ImportTransaction[]): Promise<ImportTransaction[]> {
  const result: ImportTransaction[] = []

  for (const t of transactionList) {
    if (t.installmentCurrent && t.installmentTotal) {
      const [existing] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          sql`${transactions.description} = ${t.description}
            AND ${transactions.amount} = ${t.amount}
            AND ${transactions.installmentCurrent} = ${t.installmentCurrent}
            AND ${transactions.installmentTotal} = ${t.installmentTotal}`
        )
        .limit(1)

      if (!existing) {
        result.push(t)
      }
    } else {
      result.push(t)
    }
  }

  return result
}
