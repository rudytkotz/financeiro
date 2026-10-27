import { eq, and, sql, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, income, recurringTransactions, goals } from '../db/schema.js'

export interface MonthProjection {
  month: string              // YYYY-MM
  projectedIncome: number    // centavos
  projectedExpenses: number  // centavos
  projectedBalance: number   // centavos (income - expenses)
  accumulated: number        // centavos (saldo acumulado a partir de hoje)
}

export interface FinancialHealth {
  // Médias dos últimos meses (centavos)
  avgMonthlyIncome: number
  avgMonthlyExpenses: number
  avgMonthlyBalance: number
  // Mês atual
  currentMonthIncome: number
  currentMonthExpenses: number
  savingsRate: number        // % da renda que sobra no mês atual
  // Metas
  totalGoalsTarget: number
  totalGoalsSaved: number
  // Projeção
  projection: MonthProjection[]
  monthsAnalyzed: number
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const zero = m - 1 + delta
  const year = y + Math.floor(zero / 12)
  const month = ((zero % 12) + 12) % 12
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isValidDay(day: number): boolean {
  return day >= 1 && day <= 31
}

/**
 * Calcula indicadores de saúde financeira e uma projeção de saldo para os
 * próximos meses, combinando:
 *  - médias históricas de receita/despesa (últimos N meses com dados)
 *  - transações recorrentes ativas (previsíveis)
 *  - renda fixa cadastrada
 */
export async function getFinancialHealth(userId: string, monthsAhead = 6): Promise<FinancialHealth> {
  const now = currentMonth()
  const historyStart = addMonths(now, -6) // analisa os últimos ~6 meses

  // 1. Agregados mensais de despesas e receitas (histórico)
  const monthly = await db
    .select({
      month: transactions.referenceMonth,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'despesa' THEN ${transactions.amount} ELSE 0 END), 0)`,
      incomeTx: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'receita' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.referenceMonth, historyStart),
        sql`${transactions.referenceMonth} < ${now}`, // meses fechados (exclui o atual)
      ),
    )
    .groupBy(transactions.referenceMonth)

  // Renda fixa por mês (histórico)
  const incomeRows = await db
    .select({ month: income.month, amount: income.amount })
    .from(income)
    .where(and(eq(income.userId, userId), gte(income.month, historyStart)))
  const fixedIncomeByMonth = new Map(incomeRows.map((r) => [r.month, r.amount]))

  const monthsAnalyzed = monthly.length
  let sumExpenses = 0
  let sumIncome = 0
  for (const m of monthly) {
    sumExpenses += Number(m.expenses)
    const txIncome = Number(m.incomeTx)
    const fixed = fixedIncomeByMonth.get(m.month ?? '') ?? 0
    sumIncome += txIncome + fixed
  }

  const avgMonthlyExpenses = monthsAnalyzed > 0 ? Math.round(sumExpenses / monthsAnalyzed) : 0
  const avgMonthlyIncome = monthsAnalyzed > 0 ? Math.round(sumIncome / monthsAnalyzed) : 0
  const avgMonthlyBalance = avgMonthlyIncome - avgMonthlyExpenses

  // 2. Mês atual
  const [currentAgg] = await db
    .select({
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'despesa' THEN ${transactions.amount} ELSE 0 END), 0)`,
      incomeTx: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'receita' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.referenceMonth, now)))

  const currentFixed = fixedIncomeByMonth.get(now) ?? 0
  const [currentIncomeRow] = await db
    .select({ amount: income.amount })
    .from(income)
    .where(and(eq(income.userId, userId), eq(income.month, now)))
    .limit(1)
  const currentMonthIncome = Number(currentAgg?.incomeTx ?? 0) + (currentIncomeRow?.amount ?? currentFixed)
  const currentMonthExpenses = Number(currentAgg?.expenses ?? 0)
  const savingsRate = currentMonthIncome > 0
    ? Math.round(((currentMonthIncome - currentMonthExpenses) / currentMonthIncome) * 10000) / 100
    : 0

  // 3. Recorrentes ativas (previsíveis)
  const recurring = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, true)))

  function recurringForMonth(month: string): { income: number; expenses: number } {
    let inc = 0
    let exp = 0
    for (const r of recurring) {
      if (r.startMonth > month) continue
      if (r.endMonth && r.endMonth < month) continue
      if (!isValidDay(r.dayOfMonth)) continue
      if (r.kind === 'receita') inc += r.amount
      else exp += r.amount
    }
    return { income: inc, expenses: exp }
  }

  // Despesa média não-recorrente: usa a média histórica como piso de gasto
  // variável, mas nunca menor que os recorrentes do mês.
  const projection: MonthProjection[] = []
  let accumulated = 0
  for (let i = 1; i <= monthsAhead; i++) {
    const month = addMonths(now, i)
    const rec = recurringForMonth(month)
    // Receita projetada: recorrentes de receita + renda fixa média (se houver)
    const projectedIncome = Math.max(rec.income, avgMonthlyIncome)
    // Despesa projetada: o maior entre a média histórica e os recorrentes
    const projectedExpenses = Math.max(rec.expenses, avgMonthlyExpenses)
    const projectedBalance = projectedIncome - projectedExpenses
    accumulated += projectedBalance
    projection.push({ month, projectedIncome, projectedExpenses, projectedBalance, accumulated })
  }

  // 4. Metas
  const goalRows = await db
    .select({ target: goals.targetAmount, current: goals.currentAmount })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.archived, false)))
  const totalGoalsTarget = goalRows.reduce((s, g) => s + g.target, 0)
  const totalGoalsSaved = goalRows.reduce((s, g) => s + g.current, 0)

  return {
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgMonthlyBalance,
    currentMonthIncome,
    currentMonthExpenses,
    savingsRate,
    totalGoalsTarget,
    totalGoalsSaved,
    projection,
    monthsAnalyzed,
  }
}
