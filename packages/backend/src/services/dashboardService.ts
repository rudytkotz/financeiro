import { eq, and, gte, lte, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, income } from '../db/schema.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseByCategory {
  categoryId: string
  categoryName: string
  amount: number
  percentage: number
}

export interface ExpenseByDependent {
  dependentId: string
  dependentName: string
  amount: number
}

export interface DashboardSummary {
  month: string
  totalUserExpenses: number
  incomeAmount: number | null
  balance: number | null
  expensesByCategory: ExpenseByCategory[]
  expensesByDependent: ExpenseByDependent[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthRange(month: string): { firstDay: string; lastDay: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null

  const year = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (m < 1 || m > 12) return null

  const firstDay = `${month}-01`
  const lastDate = new Date(year, m, 0)
  const lastDay = `${year}-${String(m).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { firstDay, lastDay }
}

// ---------------------------------------------------------------------------
// DashboardService
// ---------------------------------------------------------------------------

/**
 * Retorna o resumo financeiro do mês informado.
 *
 * - totalUserExpenses: soma das transações do mês onde dependent_id IS NULL
 * - incomeAmount: valor da renda cadastrada para o mês (null se não houver)
 * - balance: incomeAmount - totalUserExpenses (null se sem renda)
 * - expensesByCategory: transações sem dependente, agrupadas por categoria
 * - expensesByDependent: transações agrupadas por dependente
 */
export async function getDashboard(month: string): Promise<DashboardSummary> {
  const range = getMonthRange(month)

  if (!range) {
    return {
      month,
      totalUserExpenses: 0,
      incomeAmount: null,
      balance: null,
      expensesByCategory: [],
      expensesByDependent: [],
    }
  }

  const { firstDay, lastDay } = range

  // 1. Total de gastos do usuário (dependent_id IS NULL)
  const [userExpensesResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay),
        isNull(transactions.dependentId)
      )
    )

  const totalUserExpenses = Number(userExpensesResult.total)

  // 2. Renda do mês
  const [incomeRecord] = await db
    .select()
    .from(income)
    .where(eq(income.month, month))
    .limit(1)

  const incomeAmount = incomeRecord ? incomeRecord.amount : null
  const balance = incomeAmount !== null ? incomeAmount - totalUserExpenses : null

  // 3. Gastos por categoria (apenas transações sem dependente)
  const categoryExpenses = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay),
        isNull(transactions.dependentId)
      )
    )
    .groupBy(transactions.categoryId, categories.name)

  const expensesByCategory: ExpenseByCategory[] = categoryExpenses.map((row) => {
    const amount = Number(row.amount)
    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      amount,
      percentage: totalUserExpenses > 0 ? Math.round((amount / totalUserExpenses) * 10000) / 100 : 0,
    }
  })

  // 4. Gastos por dependente (apenas transações COM dependente)
  const dependentExpenses = await db
    .select({
      dependentId: transactions.dependentId,
      dependentName: dependents.name,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(dependents, eq(transactions.dependentId, dependents.id))
    .where(
      and(
        gte(transactions.date, firstDay),
        lte(transactions.date, lastDay),
        sql`${transactions.dependentId} IS NOT NULL`
      )
    )
    .groupBy(transactions.dependentId, dependents.name)

  const expensesByDependent: ExpenseByDependent[] = dependentExpenses.map((row) => ({
    dependentId: row.dependentId!,
    dependentName: row.dependentName,
    amount: Number(row.amount),
  }))

  return {
    month,
    totalUserExpenses,
    incomeAmount,
    balance,
    expensesByCategory,
    expensesByDependent,
  }
}
