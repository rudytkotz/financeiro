import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, income } from '../db/schema.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseByCategory {
  categoryId: string | null
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
  incomeAmount: number | null       // renda fixa cadastrada no mês (tabela income)
  transactionIncome: number         // receitas lançadas como transações no mês
  totalIncome: number               // incomeAmount + transactionIncome
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
 * Condição SQL para transações do mês: usar referenceMonth diretamente
 */
function monthCondition(month: string) {
  return sql`${transactions.referenceMonth} = ${month}`
}

// ---------------------------------------------------------------------------
// DashboardService
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  dependentId?: string | null   // null = sem dependente (pessoal), undefined = todos
  paymentMethod?: string        // filtra por forma de pagamento
}

export async function getDashboard(month: string, userId?: string, filters: DashboardFilters = {}): Promise<DashboardSummary> {
  const range = getMonthRange(month)

  if (!range) {
    return {
      month,
      totalExpenses: 0,
      totalUserExpenses: 0,
      incomeAmount: null,
      transactionIncome: 0,
      totalIncome: 0,
      balance: null,
      expensesByCategory: [],
      expensesByDependent: [],
      expensesByPaymentMethod: [],
    }
  }

  const monthCond = monthCondition(month)
  const userCond = userId ? sql`${transactions.userId} = ${userId}` : sql`1=1`
  const notDeleted = sql`${transactions.deletedAt} IS NULL`
  // Condição base para DESPESAS (exclui receitas e itens na lixeira)
  const fullCond = sql`${monthCond} AND ${userCond} AND ${notDeleted} AND ${transactions.kind} = 'despesa'`

  // 1. Total geral de gastos (apenas despesas do mês)
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

  // 2b. Receitas lançadas como transação no mês
  const [incomeTxResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(sql`${monthCond} AND ${userCond} AND ${notDeleted} AND ${transactions.kind} = 'receita'`)

  const transactionIncome = Number(incomeTxResult.total)

  // 3. Renda fixa do mês (tabela income; default 0 se não cadastrada)
  const [incomeRecord] = await db
    .select()
    .from(income)
    .where(userId ? and(eq(income.month, month), eq(income.userId, userId)) : eq(income.month, month))
    .limit(1)

  const incomeAmount = incomeRecord ? incomeRecord.amount : 0
  const totalIncome = incomeAmount + transactionIncome
  const balance = totalIncome - totalExpenses

  // 4. Gastos por categoria (com filtros opcionais de dependente e forma de pagamento)
  // Monta condições extras de forma segura usando Drizzle ORM
  const catExtraConds: ReturnType<typeof eq>[] = []
  if (filters.dependentId === null) {
    catExtraConds.push(isNull(transactions.dependentId) as any)
  } else if (filters.dependentId) {
    catExtraConds.push(eq(transactions.dependentId, filters.dependentId) as any)
  }
  if (filters.paymentMethod) {
    catExtraConds.push(eq(transactions.paymentMethod, filters.paymentMethod) as any)
  }

  const catCond = catExtraConds.length > 0
    ? and(fullCond, ...catExtraConds)!
    : fullCond

  const categoryExpenses = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(catCond)
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
    transactionIncome,
    totalIncome,
    balance,
    expensesByCategory,
    expensesByDependent,
    expensesByPaymentMethod,
  }
}
