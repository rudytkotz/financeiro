import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { budgets, categories, transactions, recurringTransactions, goals } from '../db/schema.js'

export interface Alert {
  kind: 'budget' | 'bill' | 'goal'
  severity: 'info' | 'warning' | 'danger'
  message: string
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Calcula os alertas relevantes de um usuário no momento:
 *  - Orçamentos estourados ou próximos do limite (>= 90%)
 *  - Contas recorrentes (despesas) a vencer nos próximos 5 dias
 *  - Metas atingidas
 */
export async function getAlerts(userId: string): Promise<Alert[]> {
  const month = currentMonth()
  const alerts: Alert[] = []

  // --- Orçamentos ---
  const budgetRows = await db
    .select({ categoryId: budgets.categoryId, amount: budgets.amount, name: categories.name })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)))

  if (budgetRows.length > 0) {
    const spentRows = await db
      .select({
        categoryId: transactions.categoryId,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(sql`${transactions.referenceMonth} = ${month}
        AND ${transactions.userId} = ${userId}
        AND ${transactions.kind} = 'despesa'`)
      .groupBy(transactions.categoryId)

    const spentByCat = new Map(spentRows.map((s) => [s.categoryId, Number(s.total)]))

    for (const b of budgetRows) {
      const spent = spentByCat.get(b.categoryId) ?? 0
      if (b.amount <= 0) continue
      const pct = (spent / b.amount) * 100
      if (spent > b.amount) {
        alerts.push({
          kind: 'budget',
          severity: 'danger',
          message: `Orçamento de "${b.name}" estourado: ${formatCurrency(spent)} de ${formatCurrency(b.amount)}.`,
        })
      } else if (pct >= 90) {
        alerts.push({
          kind: 'budget',
          severity: 'warning',
          message: `Orçamento de "${b.name}" quase no limite: ${pct.toFixed(0)}% usado.`,
        })
      }
    }
  }

  // --- Contas recorrentes a vencer (próximos 5 dias) ---
  const today = new Date()
  const currentDay = today.getDate()
  const recurring = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, true), eq(recurringTransactions.kind, 'despesa')))

  for (const r of recurring) {
    // Vigência cobre o mês atual?
    if (r.startMonth > month) continue
    if (r.endMonth && r.endMonth < month) continue
    const daysUntil = r.dayOfMonth - currentDay
    if (daysUntil >= 0 && daysUntil <= 5) {
      const when = daysUntil === 0 ? 'hoje' : daysUntil === 1 ? 'amanhã' : `em ${daysUntil} dias`
      alerts.push({
        kind: 'bill',
        severity: daysUntil <= 1 ? 'warning' : 'info',
        message: `Conta "${r.description}" (${formatCurrency(r.amount)}) vence ${when} (dia ${r.dayOfMonth}).`,
      })
    }
  }

  // --- Metas atingidas ---
  const goalRows = await db
    .select({ name: goals.name, target: goals.targetAmount, current: goals.currentAmount })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.archived, false)))

  for (const g of goalRows) {
    if (g.target > 0 && g.current >= g.target) {
      alerts.push({
        kind: 'goal',
        severity: 'info',
        message: `🎉 Meta "${g.name}" atingida! Você juntou ${formatCurrency(g.current)}.`,
      })
    }
  }

  return alerts
}

/** Formata os alertas numa mensagem de texto para o Telegram. */
export function formatAlertsMessage(alerts: Alert[]): string {
  if (alerts.length === 0) return '✅ Tudo em dia! Nenhum alerta no momento.'

  const icon = (s: Alert['severity']) => (s === 'danger' ? '🔴' : s === 'warning' ? '🟡' : 'ℹ️')
  const lines = alerts.map((a) => `${icon(a.severity)} ${a.message}`)
  return `🔔 *Seus alertas:*\n\n${lines.join('\n')}`
}
