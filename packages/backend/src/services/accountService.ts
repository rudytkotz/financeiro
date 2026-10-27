import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { accounts, transactions } from '../db/schema.js'
import type { Account } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'

export type { ServiceError }

export interface AccountWithBalance extends Account {
  currentBalance: number // centavos (saldo inicial - despesas + reembolsos)
}

export interface CreateAccountData {
  name: string
  type?: string
  initialBalance?: number
  color?: string | null
  closingDay?: number | null
  dueDay?: number | null
  creditLimit?: number | null
}

export type UpdateAccountData = Partial<CreateAccountData> & { archived?: boolean }

const VALID_TYPES = ['corrente', 'poupanca', 'carteira', 'cartao', 'investimento', 'outro']

function validate(data: CreateAccountData | UpdateAccountData) {
  if ('name' in data && data.name !== undefined && !data.name.trim()) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome da conta é obrigatório.')
  }
  if (data.type !== undefined && !VALID_TYPES.includes(data.type)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Tipo de conta inválido.')
  }
}

/**
 * Lista as contas do usuário com o saldo atual calculado.
 * Saldo = saldo inicial + reembolsos (amount < 0) - despesas (amount > 0),
 * já que despesas são positivas no modelo. Entradas (receitas) são negativas
 * no mesmo modelo de "amount", então somar -amount dá o efeito correto.
 */
export async function listAccounts(userId: string): Promise<AccountWithBalance[]> {
  const list = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(accounts.name)

  if (list.length === 0) return []

  // Soma de amount por conta (uma query)
  const sums = await db
    .select({
      accountId: transactions.accountId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId)

  const sumByAccount = new Map(sums.map((s) => [s.accountId, Number(s.total)]))

  return list.map((acc) => {
    // amount positivo = despesa (reduz saldo); negativo = entrada (aumenta saldo)
    const movimento = sumByAccount.get(acc.id) ?? 0
    return { ...acc, currentBalance: acc.initialBalance - movimento }
  })
}

export async function createAccount(data: CreateAccountData, userId: string): Promise<Account> {
  validate(data)
  if (!data.name?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome da conta é obrigatório.')

  const [created] = await db
    .insert(accounts)
    .values({
      name: data.name.trim(),
      type: data.type ?? 'corrente',
      initialBalance: data.initialBalance ?? 0,
      color: data.color ?? null,
      closingDay: data.closingDay ?? null,
      dueDay: data.dueDay ?? null,
      creditLimit: data.creditLimit ?? null,
      userId,
    })
    .returning()

  return created
}

export async function updateAccount(id: string, data: UpdateAccountData, userId: string): Promise<Account> {
  validate(data)
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Conta não encontrada.')

  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.type !== undefined) updates.type = data.type
  if (data.initialBalance !== undefined) updates.initialBalance = data.initialBalance
  if (data.color !== undefined) updates.color = data.color
  if (data.closingDay !== undefined) updates.closingDay = data.closingDay
  if (data.dueDay !== undefined) updates.dueDay = data.dueDay
  if (data.creditLimit !== undefined) updates.creditLimit = data.creditLimit
  if (data.archived !== undefined) updates.archived = data.archived

  const [updated] = await db
    .update(accounts)
    .set(updates)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning()
  return updated
}

export async function deleteAccount(id: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Conta não encontrada.')

  // Desvincula transações antes de remover a conta (mantém o histórico)
  await db.transaction(async (tx) => {
    await tx.update(transactions).set({ accountId: null }).where(and(eq(transactions.accountId, id), eq(transactions.userId, userId)))
    await tx.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
  })
}
