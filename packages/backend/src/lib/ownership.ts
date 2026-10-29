import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { accounts, dependents, categories } from '../db/schema.js'
import { makeError } from './errors.js'

/**
 * Helpers de validação de posse (ownership) usados pelos services para garantir
 * que um id vindo do cliente (conta, dependente, categoria) pertence de fato ao
 * usuário autenticado. Isso impede que um usuário referencie recursos de outro.
 *
 * Todas aceitam null/undefined e simplesmente retornam (campo opcional).
 */

export async function assertAccountOwnership(accountId: string | null | undefined, userId: string): Promise<void> {
  if (!accountId) return
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1)
  if (!row) throw makeError(422, 'ACCOUNT_NOT_FOUND', 'Conta não encontrada.')
}

export async function assertDependentOwnership(dependentId: string | null | undefined, userId: string): Promise<void> {
  if (!dependentId) return
  const [row] = await db
    .select({ id: dependents.id })
    .from(dependents)
    .where(and(eq(dependents.id, dependentId), eq(dependents.userId, userId)))
    .limit(1)
  if (!row) throw makeError(422, 'DEPENDENT_NOT_FOUND', 'Dependente não encontrado.')
}

export async function assertCategoryOwnership(categoryId: string | null | undefined, userId: string): Promise<void> {
  if (!categoryId) return
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!row) throw makeError(422, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
}
