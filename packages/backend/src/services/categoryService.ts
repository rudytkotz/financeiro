import { eq, sql, and, asc, desc, count, isNull, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { categories, transactions } from '../db/schema.js'
import type { Category } from '../db/schema.js'

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

export async function listCategories(userId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(or(eq(categories.userId, userId), isNull(categories.userId)))
    .orderBy(desc(categories.isDefault), asc(categories.name))
}

export async function createCategory(name: string, userId: string): Promise<Category> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria é obrigatório.')
  if (trimmed.length > 50) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria deve ter no máximo 50 caracteres.')

  const [duplicate] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(
      sql`lower(${categories.name}) = lower(${trimmed})`,
      or(eq(categories.userId, userId), isNull(categories.userId))
    ))
    .limit(1)

  if (duplicate) throw makeError(409, 'DUPLICATE_NAME', `Já existe uma categoria com o nome "${trimmed}".`)

  const [created] = await db
    .insert(categories)
    .values({ name: trimmed, isDefault: false, userId })
    .returning()

  return created
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), or(eq(categories.userId, userId), isNull(categories.userId))))
    .limit(1)

  if (!category) throw makeError(404, 'NOT_FOUND', 'Categoria não encontrada.')
  if (category.isDefault) throw makeError(409, 'IS_DEFAULT', 'Não é possível excluir uma categoria padrão.')

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.categoryId, id))

  if (total > 0) throw makeError(409, 'HAS_TRANSACTIONS', 'Não é possível excluir uma categoria com transações vinculadas.')

  await db.delete(categories).where(eq(categories.id, id))
}
