import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { budgets, categories, transactions } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'

export type { ServiceError }

export interface BudgetRow {
  id: string | null          // null quando ainda não há orçamento definido para a categoria
  categoryId: string
  categoryName: string
  categoryColor: string | null
  amount: number             // teto planejado (centavos); 0 se não definido
  spent: number              // gasto realizado no mês (centavos, apenas despesas)
  remaining: number          // amount - spent
  percentage: number         // spent / amount * 100 (0 se amount = 0)
}

export interface BudgetSummary {
  month: string
  totalBudget: number
  totalSpent: number
  rows: BudgetRow[]
}

/**
 * Retorna o orçamento do mês: para cada categoria do usuário, o teto definido
 * (se houver) e o quanto já foi gasto (apenas despesas).
 */
export async function getBudgets(month: string, userId: string): Promise<BudgetSummary> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inválido. Formato esperado: YYYY-MM.')
  }

  const cats = await db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.name)

  const budgetRows = await db
    .select({ id: budgets.id, categoryId: budgets.categoryId, amount: budgets.amount })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)))

  const spentRows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(sql`${transactions.referenceMonth} = ${month}
      AND (${transactions.userId} = ${userId} OR ${transactions.userId} IS NULL)
      AND ${transactions.kind} = 'despesa'`)
    .groupBy(transactions.categoryId)

  const budgetByCat = new Map(budgetRows.map((b) => [b.categoryId, b]))
  const spentByCat = new Map(spentRows.map((s) => [s.categoryId, Number(s.total)]))

  const rows: BudgetRow[] = cats.map((cat) => {
    const budget = budgetByCat.get(cat.id)
    const amount = budget?.amount ?? 0
    const spent = spentByCat.get(cat.id) ?? 0
    const remaining = amount - spent
    const percentage = amount > 0 ? Math.round((spent / amount) * 10000) / 100 : 0
    return {
      id: budget?.id ?? null,
      categoryId: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      amount,
      spent,
      remaining,
      percentage,
    }
  })

  const totalBudget = rows.reduce((s, r) => s + r.amount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)

  return { month, totalBudget, totalSpent, rows }
}

/**
 * Define (ou remove, se amount = 0) o orçamento de uma categoria num mês.
 */
export async function setBudget(categoryId: string, month: string, amount: number, userId: string): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inválido. Formato esperado: YYYY-MM.')
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor do orçamento deve ser zero ou positivo.')
  }

  // Verifica se a categoria pertence ao usuário
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1)
  if (!cat) throw makeError(404, 'NOT_FOUND', 'Categoria não encontrada.')

  const [existing] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.categoryId, categoryId), eq(budgets.month, month), eq(budgets.userId, userId)))
    .limit(1)

  // amount = 0 → remove o orçamento, se existir
  if (amount === 0) {
    if (existing) {
      await db.delete(budgets).where(eq(budgets.id, existing.id))
    }
    return
  }

  if (existing) {
    await db.update(budgets).set({ amount }).where(eq(budgets.id, existing.id))
  } else {
    await db.insert(budgets).values({ categoryId, month, amount, userId })
  }
}
