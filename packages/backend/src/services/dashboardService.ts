import { eq, and, gte, lte, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, income, imports } from '../db/schema.js'

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

export interface ExpenseByPaymentMethod {
  paymentMethod: string
  amount: number
  count: number
}

export interface DashboardSummary {
  month: string
  totalExpenses: number
  totalUserExpenses: number
  incomeAmount: number | null
  balance: number | null
  expensesByCategory: ExpenseByCategory[]
  expensesByDependent: ExpenseByDependent[]
  expensesByPaymentMethod: ExpenseByPaymentMethod[]
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

/**
 * Condição SQL para transações do mês: date no range OU importId vinculado ao mês
 */
function monthCondition(month: string, firstDay: string, lastDay: string) {
  return sql`(
    (${transactions.date} >= ${firstDay} AND ${transactions.date} <= ${lastDay})
    OR ${transactions.importId} IN (
      SELECT ${imports.id} FROM ${imports} WHERE ${imports.referenceMonth} = ${month}
    )
  )`
}

// ---------------------------------------------------------------------------
// DashboardService
// ---------------------------------------------------------------------------

export async function getDashboard(month: string, userId?: string): Promise<DashboardSummary> {
  const range = getMonthRange(month)

  if (!range) {
    return {
      month,
      totalExpenses: 0,
      totalUserExpenses: 0,
      incomeAmount: null,
      balance: null,
      expensesByCategory: [],
      expensesByDependent: [],
      expensesByPaymentMethod: [],
    }
  }

  const { firstDay, lastDay } = range
  const monthCond = monthCondition(month, firstDay, lastDay)
  const userCond = userId ? sql`${transactions.userId} = ${userId}` : sql`1=1`
  const fullCond = sql`${monthCond} AND ${userCond}`

  // 1. Total geral de gastos (todas as transações do mês)
  const [totalResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(fullCond)

  const totalExpenses = Number(totalResult.total)

  // 2. Total de gastos do usuário (sem dependente)
  const [userExpensesResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(sql`${fullCond} AND ${transactions.dependentId} IS NULL`)

  const totalUserExpenses = Number(userExpensesResult.total)

  // 3. Renda do mês
  const [incomeRecord] = await db
    .select()
    .from(income)
    .where(eq(income.month, month))
    .limit(1)

  const incomeAmount = incomeRecord ? incomeRecord.amount : null
  const balance = incomeAmount !== null ? incomeAmount - totalExpenses : null

  // 4. Gastos por categoria (todas as transações)
  const categoryExpenses = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(fullCond)
    .groupBy(transactions.categoryId, categories.name)

  const expensesByCategory: ExpenseByCategory[] = categoryExpenses.map((row) => {
    const amount = Number(row.amount)
    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0,
    }
  })

  // 5. Gastos por dependente
  const dependentExpenses = await db
    .select({
      dependentId: transactions.dependentId,
      dependentName: dependents.name,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(dependents, eq(transactions.dependentId, dependents.id))
    .where(sql`${fullCond} AND ${transactions.dependentId} IS NOT NULL`)
    .groupBy(transactions.dependentId, dependents.name)

  const expensesByDependent: ExpenseByDependent[] = dependentExpenses.map((row) => ({
    dependentId: row.dependentId!,
    dependentName: row.dependentName,
    amount: Number(row.amount),
  }))

  // 6. Gastos por forma de pagamento
  const paymentMethodExpenses = await db
    .select({
      paymentMethod: transactions.paymentMethod,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(transactions)
    .where(fullCond)
    .groupBy(transactions.paymentMethod)

  const expensesByPaymentMethod: ExpenseByPaymentMethod[] = paymentMethodExpenses.map((row) => ({
    paymentMethod: row.paymentMethod,
    amount: Number(row.amount),
    count: Number(row.count),
  }))

  return {
    month,
    totalExpenses,
    totalUserExpenses,
    incomeAmount,
    balance,
    expensesByCategory,
    expensesByDependent,
    expensesByPaymentMethod,
  }
}
