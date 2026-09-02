import { eq, sql, and, asc, count, isNull } from 'drizzle-orm'
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

// ---------------------------------------------------------------------------
// Default category names seeded for every new user
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORY_NAMES = [
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Moradia',
  'Vestuário',
  'Outros',
]

/**
 * Seeds default categories for a user if they have none yet.
 */
async function seedCategoriesForUser(userId: string): Promise<void> {
  await db.insert(categories).values(
    DEFAULT_CATEGORY_NAMES.map((name) => ({ name, isDefault: true, userId }))
  )
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Lists all categories for a user.
 * On first call (no categories yet), seeds the defaults automatically.
 */
export async function listCategories(userId: string): Promise<Category[]> {
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.name))

  if (existing.length === 0) {
    await seedCategoriesForUser(userId)
    return db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.name))
  }

  return existing
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
      eq(categories.userId, userId)
    ))
    .limit(1)

  if (duplicate) throw makeError(409, 'DUPLICATE_NAME', `Já existe uma categoria com o nome "${trimmed}".`)

  const [created] = await db
    .insert(categories)
    .values({ name: trimmed, isDefault: false, userId })
    .returning()

  return created
}

export async function renameCategory(id: string, name: string, userId: string): Promise<Category> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria é obrigatório.')
  if (trimmed.length > 50) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria deve ter no máximo 50 caracteres.')

  // Must belong to user
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1)

  if (!category) throw makeError(404, 'NOT_FOUND', 'Categoria não encontrada.')

  // Check duplicate name (excluding itself)
  const [duplicate] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(
      sql`lower(${categories.name}) = lower(${trimmed})`,
      eq(categories.userId, userId),
      sql`${categories.id} != ${id}`
    ))
    .limit(1)

  if (duplicate) throw makeError(409, 'DUPLICATE_NAME', `Já existe uma categoria com o nome "${trimmed}".`)

  const [updated] = await db
    .update(categories)
    .set({ name: trimmed })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning()

  return updated
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  // Must belong to user
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1)

  if (!category) throw makeError(404, 'NOT_FOUND', 'Categoria não encontrada.')

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.categoryId, id))

  if (total > 0) throw makeError(409, 'HAS_TRANSACTIONS', 'Não é possível excluir uma categoria com transações vinculadas.')

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)))
}
