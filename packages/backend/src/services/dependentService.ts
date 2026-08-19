import { eq, sql, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { dependents, transactions } from '../db/schema.js'
import type { Dependent } from '../db/schema.js'

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
// DependentService
// ---------------------------------------------------------------------------

/**
 * Lista todos os dependentes ordenados por nome (ASC).
 */
export async function listDependents(): Promise<Dependent[]> {
  return db
    .select()
    .from(dependents)
    .orderBy(dependents.name)
}

/**
 * Cria um novo dependente.
 *
 * Regras:
 *  - name não pode ser vazio e deve ter no máximo 50 caracteres (422)
 *  - Não pode haver outro dependente com o mesmo nome (case-insensitive) (409)
 *  - Não pode haver mais de 10 dependentes no total (422)
 */
export async function createDependent(name: string): Promise<Dependent> {
  // Validação: campo obrigatório e comprimento máximo
  const trimmed = name?.trim() ?? ''
  if (!trimmed) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome do dependente é obrigatório.')
  }
  if (trimmed.length > 50) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome do dependente deve ter no máximo 50 caracteres.')
  }

  // Verificar unicidade case-insensitive
  const [duplicate] = await db
    .select({ id: dependents.id })
    .from(dependents)
    .where(sql`lower(${dependents.name}) = lower(${trimmed})`)
    .limit(1)

  if (duplicate) {
    throw makeError(409, 'DUPLICATE_NAME', `Já existe um dependente com o nome "${trimmed}".`)
  }

  // Verificar limite de 10 dependentes
  const [{ total }] = await db
    .select({ total: count() })
    .from(dependents)

  if (total >= 10) {
    throw makeError(422, 'LIMIT_REACHED', 'O limite máximo de 10 dependentes foi atingido.')
  }

  // Inserir e retornar o registro criado
  const [created] = await db
    .insert(dependents)
    .values({ name: trimmed })
    .returning()

  return created
}

/**
 * Remove um dependente.
 *
 * Regra:
 *  - Não pode ser removido se houver transações vinculadas (409)
 */
export async function deleteDependent(id: string): Promise<void> {
  // Verificar transações vinculadas
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.dependentId, id))

  if (total > 0) {
    throw makeError(
      409,
      'HAS_TRANSACTIONS',
      'Não é possível remover este dependente pois existem transações vinculadas a ele.'
    )
  }

  await db.delete(dependents).where(eq(dependents.id, id))
}
