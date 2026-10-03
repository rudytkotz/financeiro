import { eq, sql, and, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { dependents, transactions } from '../db/schema.js'
import type { Dependent } from '../db/schema.js'

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

export async function listDependents(userId: string): Promise<Dependent[]> {
  return db
    .select()
    .from(dependents)
    .where(eq(dependents.userId, userId))
    .orderBy(dependents.name)
}

export async function createDependent(name: string, userId: string): Promise<Dependent> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) throw makeError(422, 'VALIDATION_ERROR', 'O nome do dependente é obrigatório.')
  if (trimmed.length > 50) throw makeError(422, 'VALIDATION_ERROR', 'O nome do dependente deve ter no máximo 50 caracteres.')

  const [duplicate] = await db
    .select({ id: dependents.id })
    .from(dependents)
    .where(and(
      sql`lower(${dependents.name}) = lower(${trimmed})`,
      eq(dependents.userId, userId)
    ))
    .limit(1)

  if (duplicate) throw makeError(409, 'DUPLICATE_NAME', `Já existe um dependente com o nome "${trimmed}".`)

  const [{ total }] = await db
    .select({ total: count() })
    .from(dependents)
    .where(eq(dependents.userId, userId))

  if (total >= 10) throw makeError(422, 'LIMIT_REACHED', 'O limite máximo de 10 dependentes foi atingido.')

  const [created] = await db
    .insert(dependents)
    .values({ name: trimmed, userId })
    .returning()

  return created
}

/**
 * Define o dependente principal do usuário.
 * Remove o flag isMain de todos os outros dependentes do mesmo usuário
 * e seta isMain = true no dependente especificado.
 * Se id = null, apenas remove o flag de todos (sem principal).
 */
export async function setMainDependent(id: string | null, userId: string): Promise<Dependent | null> {
  // Remover isMain de todos os dependentes do usuário
  await db
    .update(dependents)
    .set({ isMain: false })
    .where(eq(dependents.userId, userId))

  if (!id) return null

  // Verificar que o dependente pertence ao usuário
  const [dep] = await db
    .select()
    .from(dependents)
    .where(and(eq(dependents.id, id), eq(dependents.userId, userId)))
    .limit(1)

  if (!dep) throw makeError(404, 'NOT_FOUND', 'Dependente não encontrado.')

  // Setar como principal
  const [updated] = await db
    .update(dependents)
    .set({ isMain: true })
    .where(eq(dependents.id, id))
    .returning()

  return updated
}

export async function deleteDependent(id: string, userId: string): Promise<void> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.dependentId, id))

  if (total > 0) throw makeError(409, 'HAS_TRANSACTIONS', 'Não é possível remover este dependente pois existem transações vinculadas.')

  await db.delete(dependents).where(and(eq(dependents.id, id), eq(dependents.userId, userId)))
}
