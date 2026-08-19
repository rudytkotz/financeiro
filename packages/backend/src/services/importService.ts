import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { imports, transactions } from '../db/schema.js'
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
export async function checkDuplicate(referenceMonth: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(eq(imports.referenceMonth, referenceMonth))
    .limit(1)

  return !!existing
}

/**
 * Persiste uma importação com suas transações dentro de uma transação SQL.
 *
 * - Calcula o reference_month a partir das transações
 * - Insere registro em `imports` com importedAt = now e transactionCount
 * - Insere todas as transações em batch com source = 'csv' e importId vinculado
 *
 * Retorna o registro de importação criado.
 */
export async function saveImport(transactionList: ImportTransaction[]): Promise<Import> {
  if (transactionList.length === 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'Nenhuma transação fornecida para importação.')
  }

  const referenceMonth = calculateReferenceMonth(transactionList)

  const result = await db.transaction(async (tx) => {
    // Inserir registro de importação
    const [importRecord] = await tx
      .insert(imports)
      .values({
        referenceMonth,
        importedAt: new Date(),
        transactionCount: transactionList.length,
      })
      .returning()

    // Inserir transações em batch
    await tx.insert(transactions).values(
      transactionList.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryId: t.categoryId,
        dependentId: t.dependentId ?? null,
        portador: t.portador ?? null,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        source: 'csv' as const,
        importId: importRecord.id,
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
  transactionList: ImportTransaction[]
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
    const newReferenceMonth = calculateReferenceMonth(transactionList)

    // Inserir novo registro de importação
    const [importRecord] = await tx
      .insert(imports)
      .values({
        referenceMonth: newReferenceMonth,
        importedAt: new Date(),
        transactionCount: transactionList.length,
      })
      .returning()

    // Inserir novas transações em batch
    await tx.insert(transactions).values(
      transactionList.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryId: t.categoryId,
        dependentId: t.dependentId ?? null,
        portador: t.portador ?? null,
        installmentCurrent: t.installmentCurrent ?? null,
        installmentTotal: t.installmentTotal ?? null,
        source: 'csv' as const,
        importId: importRecord.id,
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
