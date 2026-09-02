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
const DEFAULT_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: 'Alimentação',           color: '#f97316' },
  { name: 'Assinaturas e serviços', color: '#6366f1' },
  { name: 'Bares e restaurantes',  color: '#f43f5e' },
  { name: 'Casa',                  color: '#14b8a6' },
  { name: 'Compras',               color: '#a855f7' },
  { name: 'Cuidados pessoais',     color: '#ec4899' },
  { name: 'Dívidas e empréstimos', color: '#ef4444' },
  { name: 'Educação',              color: '#8b5cf6' },
  { name: 'Lazer e hobbies',       color: '#0ea5e9' },
  { name: 'Mercado',               color: '#22c55e' },
  { name: 'Outros',                color: '#6b7280' },
  { name: 'Pets',                  color: '#84cc16' },
  { name: 'Presentes',             color: '#f59e0b' },
  { name: 'Roupas',                color: '#e879f9' },
  { name: 'Saúde',                 color: '#10b981' },
  { name: 'Trabalho',              color: '#3b82f6' },
  { name: 'Transporte',            color: '#64748b' },
  { name: 'Viagem',                color: '#eab308' },
]

// Set of canonical default names for sync comparison (lowercase)
const DEFAULT_NAMES_SET = new Set(DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase()))

/**
 * Inserts the full default category list for a user.
 */
async function seedCategoriesForUser(userId: string): Promise<void> {
  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map(({ name, color }) => ({ name, color, isDefault: true, userId }))
  )
}

/**
 * Syncs default categories for existing users:
 * - Deletes default categories that are no longer in the canonical list AND have no transactions
 * - Inserts any canonical defaults that are missing
 */
async function syncDefaultCategories(userId: string, existing: Category[]): Promise<void> {
  const existingDefaults = existing.filter((c) => c.isDefault)

  // 1. Remove obsolete defaults (not in current list) that have no transactions
  const obsolete = existingDefaults.filter((c) => !DEFAULT_NAMES_SET.has(c.name.toLowerCase()))
  for (const cat of obsolete) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.categoryId, cat.id))
    if (total === 0) {
      await db.delete(categories).where(eq(categories.id, cat.id))
    }
  }

  // 2. Insert missing defaults
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
  const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name.toLowerCase()))
  if (missing.length > 0) {
    await db.insert(categories).values(
      missing.map(({ name, color }) => ({ name, color, isDefault: true, userId }))
    )
  }
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Lists all categories for a user.
 * - First access: seeds the full default list.
 * - Subsequent accesses: syncs defaults (removes obsolete, adds missing).
 */
export async function listCategories(userId: string): Promise<Category[]> {
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.name))

  if (existing.length === 0) {
    await seedCategoriesForUser(userId)
  } else {
    await syncDefaultCategories(userId, existing)
  }

  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.name))
}

export async function createCategory(name: string, userId: string, color?: string | null): Promise<Category> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria é obrigatório.')
  if (trimmed.length > 50) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria deve ter no máximo 50 caracteres.')
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw makeError(422, 'VALIDATION_ERROR', 'Cor inválida. Use formato hex (#rrggbb).')

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
    .values({ name: trimmed, color: color ?? null, isDefault: false, userId })
    .returning()

  return created
}

export async function renameCategory(id: string, name: string, userId: string, color?: string | null): Promise<Category> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria é obrigatório.')
  if (trimmed.length > 50) throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria deve ter no máximo 50 caracteres.')
  if (color !== undefined && color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Cor inválida. Use formato hex (#rrggbb).')
  }

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

  const updateValues: Record<string, unknown> = { name: trimmed }
  if (color !== undefined) updateValues.color = color

  const [updated] = await db
    .update(categories)
    .set(updateValues)
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
