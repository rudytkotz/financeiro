import { eq, sql, asc, desc, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { categories, transactions } from '../db/schema.js'
import type { Category } from '../db/schema.js'

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
// CategoryService
// ---------------------------------------------------------------------------

/**
 * Lista todas as categorias (padrão + personalizadas) ordenadas por
 * isDefault DESC, name ASC.
 * Categorias padrão aparecem primeiro, depois as personalizadas — ambos
 * os grupos ordenados alfabeticamente.
 */
export async function listCategories(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .orderBy(desc(categories.isDefault), asc(categories.name))
}

/**
 * Cria uma nova categoria personalizada.
 *
 * Validações:
 *  - name não pode ser vazio e deve ter no máximo 50 caracteres → 422 VALIDATION_ERROR
 *  - name deve ser único (case-insensitive) → 409 DUPLICATE_NAME
 */
export async function createCategory(name: string): Promise<Category> {
  const trimmed = name?.trim() ?? ''

  // 422 — campo obrigatório e comprimento máximo
  if (!trimmed) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria é obrigatório.')
  }
  if (trimmed.length > 50) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome da categoria deve ter no máximo 50 caracteres.')
  }

  // 409 — verificar unicidade case-insensitive
  const [duplicate] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${trimmed})`)
    .limit(1)

  if (duplicate) {
    throw makeError(409, 'DUPLICATE_NAME', `Já existe uma categoria com o nome "${trimmed}".`)
  }

  // Inserir e retornar o registro criado
  const [created] = await db
    .insert(categories)
    .values({ name: trimmed, isDefault: false })
    .returning()

  return created
}

/**
 * Remove uma categoria personalizada por id.
 *
 * Regras:
 *  1. Categorias padrão não podem ser removidas → 409 IS_DEFAULT
 *  2. Categorias com transações vinculadas não podem ser removidas → 409 HAS_TRANSACTIONS
 */
export async function deleteCategory(id: string): Promise<void> {
  // Buscar a categoria
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)

  if (!category) {
    throw makeError(404, 'NOT_FOUND', 'Categoria não encontrada.')
  }

  // Bloquear exclusão de categorias padrão
  if (category.isDefault) {
    throw makeError(409, 'IS_DEFAULT', 'Não é possível excluir uma categoria padrão.')
  }

  // Bloquear exclusão quando há transações vinculadas
  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.categoryId, id))

  if (total > 0) {
    throw makeError(
      409,
      'HAS_TRANSACTIONS',
      'Não é possível excluir uma categoria com transações vinculadas.'
    )
  }

  await db.delete(categories).where(eq(categories.id, id))
}
