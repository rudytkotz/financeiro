import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { accounts, transactions } from '../db/schema.js'
import type { Transaction } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'

export type { ServiceError }

export interface InvoiceSummary {
  accountId: string
  accountName: string
  referenceMonth: string        // YYYY-MM do vencimento
  closingDate: string           // YYYY-MM-DD (fechamento desta fatura)
  dueDate: string               // YYYY-MM-DD (vencimento desta fatura)
  previousClosingDate: string   // YYYY-MM-DD (fechamento da fatura anterior)
  total: number                 // centavos (soma das despesas do ciclo)
  creditLimit: number | null
  limitUsagePct: number | null  // total do ciclo / limite
  transactions: Transaction[]
}

function clampDay(year: number, month1to12: number, day: number): string {
  const lastDay = new Date(year, month1to12, 0).getDate()
  const d = Math.min(day, lastDay)
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addMonths(year: number, month1to12: number, delta: number): { year: number; month: number } {
  const zero = month1to12 - 1 + delta
  const y = year + Math.floor(zero / 12)
  const m = ((zero % 12) + 12) % 12
  return { year: y, month: m + 1 }
}

/**
 * Calcula a fatura de um cartão para o mês de vencimento informado.
 *
 * Ciclo: a fatura que vence em `month` fecha em `closingDay` do mês do
 * vencimento (ou do mês anterior, dependendo do cartão). Para simplificar e
 * cobrir o caso mais comum, consideramos que a fatura com vencimento em `month`
 * acumula as compras feitas entre o fechamento do mês anterior (exclusive) e o
 * fechamento do mês do vencimento (inclusive).
 */
export async function getInvoice(accountId: string, month: string, userId: string): Promise<InvoiceSummary> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Mês inválido. Formato esperado: YYYY-MM.')
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1)
  if (!account) throw makeError(404, 'NOT_FOUND', 'Conta não encontrada.')
  if (account.type !== 'cartao') throw makeError(422, 'NOT_A_CARD', 'A conta informada não é um cartão de crédito.')

  const closingDay = account.closingDay ?? 1
  const dueDay = account.dueDay ?? 10

  const [year, mon] = month.split('-').map(Number)

  // Fechamento desta fatura (no mês do vencimento) e da anterior (mês anterior)
  const closingDate = clampDay(year, mon, closingDay)
  const prev = addMonths(year, mon, -1)
  const previousClosingDate = clampDay(prev.year, prev.month, closingDay)
  const dueDate = clampDay(year, mon, dueDay)

  // Transações do cartão no intervalo (previousClosing, closing]
  const txs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.userId, userId),
        eq(transactions.kind, 'despesa'),
        gte(transactions.date, previousClosingDate),
        lte(transactions.date, closingDate),
      ),
    )
    .orderBy(transactions.date)

  // Exclui exatamente o dia do fechamento anterior (intervalo aberto no início)
  const cycleTxs = txs.filter((t) => t.date > previousClosingDate)

  const total = cycleTxs.reduce((sum, t) => sum + t.amount, 0)
  const creditLimit = account.creditLimit ?? null
  const limitUsagePct = creditLimit && creditLimit > 0
    ? Math.round((total / creditLimit) * 10000) / 100
    : null

  return {
    accountId: account.id,
    accountName: account.name,
    referenceMonth: month,
    closingDate,
    dueDate,
    previousClosingDate,
    total,
    creditLimit,
    limitUsagePct,
    transactions: cycleTxs,
  }
}

/**
 * Soma do uso total de um cartão (todas as despesas vinculadas), para exibir
 * uso do limite independente do ciclo.
 */
export async function getCardUsage(accountId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, userId), eq(transactions.kind, 'despesa')))
  return Number(row.total)
}
