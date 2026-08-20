import { eq, sql, and, count, or, isNull } from 'drizzle-orm'
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
    .where(or(eq(dependents.userId, userId), isNull(dependents.userId)))
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
      or(eq(dependents.userId, userId), isNull(dependents.userId))
    ))
    .limit(1)

  if (duplicate) throw makeError(409, 'DUPLICATE_NAME', `Já existe um dependente com o nome "${trimmed}".`)

  const [{ total }] = await db
    .select({ total: count() })
    .from(dependents)
    .where(or(eq(dependents.userId, userId), isNull(dependents.userId)))

  if (total >= 10) throw makeError(422, 'LIMIT_REACHED', 'O limite máximo de 10 dependentes foi atingido.')

  const [created] = await db
    .insert(dependents)
    .values({ name: trimmed, userId })
    .returning()

  return created
}

export async function deleteDependent(id: string, userId: string): Promise<void> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.dependentId, id))

  if (total > 0) throw makeError(409, 'HAS_TRANSACTIONS', 'Não é possível remover este dependente pois existem transações vinculadas.')

  await db.delete(dependents).where(and(eq(dependents.id, id), or(eq(dependents.userId, userId), isNull(dependents.userId))))
}
