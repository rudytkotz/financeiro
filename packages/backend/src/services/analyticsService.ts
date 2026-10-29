import { and, eq, gte, lte, ne, isNull, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, income, recurringTransactions, portfolioSnapshots } from '../db/schema.js'
import type {
  MonthComparison, MonthComparisonCategory,
  CashFlowForecast, CashFlowItem,
  NetWorthPoint, YearlyReport, TransactionSearchResult,
} from '@financeiro/shared'
import { listAccounts, getInvestedByAccount } from './accountService.js'

// ---------------------------------------------------------------------------
// Helpers de mês
// ---------------------------------------------------------------------------
function offsetMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function clampDay(ym: string, day: number): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(Math.min(day, last)).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// 1. Comparativo mensal (este mês vs anterior vs média)
// ---------------------------------------------------------------------------
export async function getMonthComparison(month: string, userId: string, lookback = 3): Promise<MonthComparison> {
  const previousMonth = offsetMonth(month, -1)
  // Meses a analisar para a média: os `lookback` meses anteriores ao atual
  const months: string[] = []
  for (let i = 1; i <= lookback; i++) months.push(offsetMonth(month, -i))

  const relevant = [month, ...months]

  // Despesas por categoria em todos os meses relevantes, numa query
  const rows = await db
    .select({
      month: transactions.referenceMonth,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.kind, 'despesa'),
      isNull(transactions.deletedAt),
      inArray(transactions.referenceMonth, relevant),
    ))
    .groupBy(transactions.referenceMonth, transactions.categoryId, categories.name)

  // Agrega por categoria
  const map = new Map<string, MonthComparisonCategory>()
  const key = (id: string | null) => id ?? '__none__'

  for (const r of rows) {
    const k = key(r.categoryId)
    const entry = map.get(k) ?? {
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? 'Sem categoria',
      current: 0, previous: 0, average: 0, changePct: null,
    }
    const amount = Number(r.total)
    if (r.month === month) entry.current += amount
    else if (r.month === previousMonth) entry.previous += amount
    map.set(k, entry)
  }

  // Média dos meses anteriores por categoria
  const sumPrev = new Map<string, number>()
  for (const r of rows) {
    if (r.month === month) continue
    const k = key(r.categoryId)
    sumPrev.set(k, (sumPrev.get(k) ?? 0) + Number(r.total))
  }

  const categoriesOut: MonthComparisonCategory[] = [...map.values()].map((c) => {
    const k = key(c.categoryId)
    c.average = Math.round((sumPrev.get(k) ?? 0) / lookback)
    c.changePct = c.previous > 0 ? Math.round(((c.current - c.previous) / c.previous) * 10000) / 100 : null
    return c
  }).sort((a, b) => b.current - a.current)

  const currentTotal = categoriesOut.reduce((s, c) => s + c.current, 0)
  const previousTotal = categoriesOut.reduce((s, c) => s + c.previous, 0)
  const averageTotal = categoriesOut.reduce((s, c) => s + c.average, 0)

  return {
    month,
    previousMonth,
    monthsAnalyzed: lookback,
    currentTotal,
    previousTotal,
    averageTotal,
    changePct: previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 10000) / 100 : null,
    categories: categoriesOut,
  }
}

// ---------------------------------------------------------------------------
// 2. Fluxo de caixa projetado do mês
// ---------------------------------------------------------------------------
export async function getCashFlowForecast(month: string, userId: string): Promise<CashFlowForecast> {
  const accounts = await listAccounts(userId)
  const currentBalance = accounts
    .filter((a) => !a.archived && a.type !== 'cartao')
    .reduce((s, a) => s + a.currentBalance, 0)

  // Já realizado no mês
  const [realized] = await db
    .select({
      exp: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'despesa' THEN ${transactions.amount} ELSE 0 END), 0)`,
      inc: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'receita' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.referenceMonth, month),
      isNull(transactions.deletedAt),
      ne(transactions.kind, 'transfer'),
    ))

  const realizedExpenses = Number(realized.exp)
  const realizedIncome = Number(realized.inc)

  const pendingItems: CashFlowItem[] = []

  // Recorrentes ativas que valem para o mês e ainda não foram materializadas
  const models = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, true)))

  const materialized = await db
    .select({ recurringId: transactions.recurringId })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.referenceMonth, month),
      isNull(transactions.deletedAt),
      sql`${transactions.recurringId} IS NOT NULL`,
    ))
  const done = new Set(materialized.map((m) => m.recurringId))

  for (const m of models) {
    if (m.startMonth > month) continue
    if (m.endMonth && m.endMonth < month) continue
    if (done.has(m.id)) continue
    pendingItems.push({
      description: m.description,
      amount: m.kind === 'receita' ? -m.amount : m.amount, // saída positiva, entrada negativa
      date: clampDay(month, m.dayOfMonth),
      kind: m.kind === 'receita' ? 'renda' : 'recorrente',
    })
  }

  // Parcelas futuras: transações do mês com parcela corrente < total já estão lançadas;
  // aqui consideramos apenas as recorrentes para manter o escopo determinístico.

  const projectedExpenses = pendingItems.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0)
  const projectedIncome = pendingItems.filter((i) => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0)

  return {
    month,
    currentBalance,
    realizedExpenses,
    realizedIncome,
    pendingItems: pendingItems.sort((a, b) => a.date.localeCompare(b.date)),
    projectedExpenses,
    projectedIncome,
    projectedEndBalance: currentBalance - projectedExpenses + projectedIncome,
  }
}

// ---------------------------------------------------------------------------
// 3. Evolução patrimonial consolidada (contas + investimentos)
// ---------------------------------------------------------------------------
export async function getNetWorthEvolution(userId: string, months = 12): Promise<NetWorthPoint[]> {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Saldo das contas ao fim de cada mês = saldo inicial + movimentações até aquele mês.
  // Reaproveitamos listAccounts (saldo atual) e reconstruímos o histórico pela soma
  // de transações por referenceMonth.
  const accounts = await listAccounts(userId)
  const nonCard = accounts.filter((a) => a.type !== 'cartao' && !a.archived)
  const baseInitial = nonCard.reduce((s, a) => s + a.initialBalance, 0)

  // Soma de movimentações por mês (despesa reduz, receita aumenta — amount com sinal)
  const movs = await db
    .select({
      month: transactions.referenceMonth,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      ne(transactions.kind, 'transfer'),
      sql`${transactions.accountId} IS NOT NULL`,
    ))
    .groupBy(transactions.referenceMonth)

  const movByMonth = new Map<string, number>(
    movs.filter((m): m is { month: string; total: string } => m.month !== null)
      .map((m) => [m.month, Number(m.total)]),
  )

  // Investido: usamos os snapshots mensais REAIS do patrimônio (portfolio_snapshots)
  // quando existem para o mês. Para meses sem snapshot (ex: antes de começar a usar
  // o app), caímos numa aproximação com o valor atual, marcando como estimado.
  const snaps = await db
    .select({ month: portfolioSnapshots.month, totalCurrent: portfolioSnapshots.totalCurrent })
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.userId, userId))
    .orderBy(portfolioSnapshots.month)

  const snapByMonth = new Map(snaps.map((s) => [s.month, s.totalCurrent]))
  const invested = await getInvestedByAccount(userId)
  const currentInvested = [...invested.values()].reduce((s, v) => s + v.value, 0)

  // Preenche lacunas: se um mês não tem snapshot, usa o snapshot anterior mais
  // próximo (carry-forward); se nem isso, usa o investido atual. Marca estimado.
  function investedForMonth(ym: string): { value: number; estimated: boolean } {
    const exact = snapByMonth.get(ym)
    if (exact !== undefined) return { value: exact, estimated: false }
    // último snapshot com mês <= ym
    let carried: number | null = null
    for (const s of snaps) {
      if (s.month <= ym) carried = s.totalCurrent
      else break
    }
    if (carried !== null) return { value: carried, estimated: true }
    return { value: currentInvested, estimated: true }
  }

  const points: NetWorthPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const ym = offsetMonth(currentMonth, -i)
    // Saldo em contas acumulado até o fim de ym
    let acc = baseInitial
    for (const [mm, total] of movByMonth) {
      if (mm && mm <= ym) acc -= total // amount positivo = despesa (reduz)
    }
    const inv = investedForMonth(ym)
    points.push({
      month: ym,
      accounts: acc,
      investments: inv.value,
      total: acc + inv.value,
      investmentsEstimated: inv.estimated,
    })
  }
  return points
}

// ---------------------------------------------------------------------------
// 4. Retrospectiva anual
// ---------------------------------------------------------------------------
export async function getYearlyReport(year: number, userId: string): Promise<YearlyReport> {
  const start = `${year}-01`
  const end = `${year}-12`

  const rows = await db
    .select({
      month: transactions.referenceMonth,
      kind: transactions.kind,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      ne(transactions.kind, 'transfer'),
      gte(transactions.referenceMonth, start),
      lte(transactions.referenceMonth, end),
    ))
    .groupBy(transactions.referenceMonth, transactions.kind, transactions.categoryId, categories.name)

  // Renda fixa cadastrada no ano
  const incomeRows = await db
    .select({ month: income.month, amount: income.amount })
    .from(income)
    .where(and(eq(income.userId, userId), gte(income.month, start), lte(income.month, end)))

  const byMonthMap = new Map<string, { income: number; expenses: number }>()
  const catMap = new Map<string, { name: string; amount: number }>()

  for (let m = 1; m <= 12; m++) byMonthMap.set(`${year}-${String(m).padStart(2, '0')}`, { income: 0, expenses: 0 })

  for (const r of rows) {
    if (!r.month) continue
    const bucket = byMonthMap.get(r.month) ?? { income: 0, expenses: 0 }
    const amount = Number(r.total)
    if (r.kind === 'despesa') {
      bucket.expenses += amount
      const k = r.categoryId ?? '__none__'
      const c = catMap.get(k) ?? { name: r.categoryName ?? 'Sem categoria', amount: 0 }
      c.amount += amount
      catMap.set(k, c)
    } else if (r.kind === 'receita') {
      bucket.income += amount
    }
    byMonthMap.set(r.month, bucket)
  }
  for (const r of incomeRows) {
    const bucket = byMonthMap.get(r.month) ?? { income: 0, expenses: 0 }
    bucket.income += r.amount
    byMonthMap.set(r.month, bucket)
  }

  const byMonth = [...byMonthMap.entries()].sort().map(([month, v]) => ({
    month, income: v.income, expenses: v.expenses, balance: v.income - v.expenses,
  }))

  const totalIncome = byMonth.reduce((s, m) => s + m.income, 0)
  const totalExpenses = byMonth.reduce((s, m) => s + m.expenses, 0)
  const topCategories = [...catMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((c) => ({ categoryName: c.name, amount: c.amount }))

  const mostExpensive = byMonth.reduce<{ month: string; amount: number } | null>((acc, m) => {
    if (!acc || m.expenses > acc.amount) return { month: m.month, amount: m.expenses }
    return acc
  }, null)

  return {
    year,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100 : 0,
    topCategories,
    byMonth,
    mostExpensiveMonth: mostExpensive && mostExpensive.amount > 0 ? mostExpensive : null,
  }
}

// ---------------------------------------------------------------------------
// 5. Busca global de transações (atravessa meses)
// ---------------------------------------------------------------------------
export async function searchTransactions(query: string, userId: string, limit = 200): Promise<TransactionSearchResult> {
  const q = query.trim()
  if (!q) return { transactions: [], total: 0, count: 0 }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      sql`lower(${transactions.description}) LIKE ${'%' + q.toLowerCase() + '%'}`,
    ))
    .orderBy(sql`${transactions.date} DESC`)
    .limit(limit)

  const total = rows.reduce((s, t) => s + (t.kind === 'despesa' ? t.amount : 0), 0)
  return { transactions: rows as unknown as TransactionSearchResult['transactions'], total, count: rows.length }
}
