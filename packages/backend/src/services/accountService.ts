import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { accounts, transactions, investments } from '../db/schema.js'
import type { Account } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'
import { getPortfolioSummary, getRvPositions } from './investmentService.js'
import { assertAccountOwnership, assertDependentOwnership } from '../lib/ownership.js'

export type { ServiceError }

export interface AccountWithBalance extends Account {
  currentBalance: number // centavos (saldo inicial - despesas + reembolsos)
}

/** Resumo agregado de uma conta: saldo, investimentos vinculados e atividade. */
export interface AccountSummary {
  accountId: string
  currentBalance: number       // centavos
  investedCurrent: number      // centavos (valor atual dos investimentos vinculados)
  investmentCount: number      // nº de ativos vinculados
  transactionCount: number     // nº total de transações vinculadas
  linkedCardCount: number      // nº de cartões filhos (contas com parentAccountId = este)
  cardUsageCurrent: number      // uso real do cartão em despesa (centavos)
  creditLimit: number | null   // limite do cartão (centavos)
  limitUsagePct: number | null // % usado do cartão
}

export interface CreateAccountData {
  name: string
  type?: string
  initialBalance?: number
  color?: string | null
  closingDay?: number | null
  dueDay?: number | null
  creditLimit?: number | null
  parentAccountId?: string | null
  dependentId?: string | null
}

export type UpdateAccountData = Partial<CreateAccountData> & { archived?: boolean }

export interface AccountsOverviewCounts {
  total: number
  operational: number
  archived: number
  cartoes: number
  investimentos: number
}

export interface AccountsOverviewCardsSummary {
  count: number
  totalLimit: number
  totalUsage: number
}

export interface AccountsOverviewInvestmentsSummary {
  linked: number
  orphans: number
}

export interface AccountsOverviewSummary {
  operationalBalance: number
  totalInvested: number
  patrimonio: number
  cards: AccountsOverviewCardsSummary
  investments: AccountsOverviewInvestmentsSummary
  counts: AccountsOverviewCounts
}

const VALID_TYPES = ['corrente', 'poupanca', 'carteira', 'cartao', 'investimento', 'outro']

export function buildAccountsOverviewSummary(input: {
  accounts: Array<{ id: string; type: string; initialBalance: number; archived: boolean; creditLimit?: number | null; currentBalance?: number }>
  totalInvested: number
  cardUsageByAccount?: Map<string, number>
  linkedInvestmentCount?: number
  orphanInvestmentCount?: number
  counts?: AccountsOverviewCounts
}): AccountsOverviewSummary {
  const operationalAccounts = input.accounts.filter(
    (account) => !account.archived && ['corrente', 'poupanca', 'carteira', 'outro'].includes(account.type),
  )

  const cards = input.accounts.filter((account) => !account.archived && account.type === 'cartao')
  const cardUsageByAccount = input.cardUsageByAccount ?? new Map<string, number>()
  const totalUsage = cards.reduce((sum, card) => sum + (cardUsageByAccount.get(card.id) ?? 0), 0)
  const totalLimit = cards.reduce((sum, card) => sum + (card.creditLimit ?? 0), 0)

  const operationalBalance = operationalAccounts.reduce((sum, account) => {
    const current = account.currentBalance ?? account.initialBalance
    return sum + current
  }, 0)

  const counts = input.counts ?? {
    total: input.accounts.length,
    operational: operationalAccounts.length,
    archived: input.accounts.filter((account) => account.archived).length,
    cartoes: cards.length,
    investimentos: input.accounts.filter((account) => !account.archived && account.type === 'investimento').length,
  }

  return {
    operationalBalance,
    totalInvested: input.totalInvested,
    patrimonio: operationalBalance + input.totalInvested,
    cards: {
      count: cards.length,
      totalLimit,
      totalUsage,
    },
    investments: {
      linked: input.linkedInvestmentCount ?? 0,
      orphans: input.orphanInvestmentCount ?? 0,
    },
    counts,
  }
}

export function validateAccountParentLink(
  type: string | undefined,
  parentAccountId: string | null | undefined,
  currentAccountId?: string | null,
): void {
  if (!parentAccountId) return

  if (type !== 'cartao') {
    throw makeError(422, 'VALIDATION_ERROR', 'Cartões só podem ter conta pai.')
  }

  if (currentAccountId && parentAccountId === currentAccountId) {
    throw makeError(422, 'VALIDATION_ERROR', 'Uma conta não pode ser vinculada a si mesma.')
  }
}

function validate(data: CreateAccountData | UpdateAccountData, currentType?: string, currentAccountId?: string) {
  if ('name' in data && data.name !== undefined && !data.name.trim()) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome da conta é obrigatório.')
  }
  if (data.type !== undefined && !VALID_TYPES.includes(data.type)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Tipo de conta inválido.')
  }

  if (currentType !== undefined || data.type !== undefined || data.parentAccountId !== undefined) {
    const effectiveType = data.type ?? currentType
    const effectiveParentAccountId = data.parentAccountId ?? null
    validateAccountParentLink(effectiveType, effectiveParentAccountId, currentAccountId)
  }
}

/**
 * Lista as contas do usuário com o saldo atual calculado.
 * Saldo = saldo inicial + reembolsos (amount < 0) - despesas (amount > 0),
 * já que despesas são positivas no modelo. Entradas (receitas) são negativas
 * no mesmo modelo de "amount", então somar -amount dá o efeito correto.
 */
/**
 * Calcula o valor investido (atual) agrupado por conta/corretora.
 * RV ao valor de mercado (via posições); RF pelo valor aplicado.
 * Retorna um mapa accountId → { value (centavos), count }.
 */
export async function getInvestedByAccount(userId: string): Promise<Map<string, { value: number; count: number }>> {
  const result = new Map<string, { value: number; count: number }>()

  // Renda fixa: soma do valor aplicado por conta
  const rfAgg = await db
    .select({
      accountId: investments.accountId,
      total: sql<string>`COALESCE(SUM(${investments.investedAmount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.type, 'renda_fixa')))
    .groupBy(investments.accountId)

  for (const r of rfAgg) {
    if (!r.accountId) continue
    result.set(r.accountId, { value: Number(r.total), count: Number(r.count) })
  }

  // Renda variável: valor atual de mercado por conta (reaproveita posições)
  const rvPositions = await getRvPositions(userId)
  for (const pos of rvPositions) {
    if (pos.quantity <= 0) continue
    const accId = pos.investment.accountId
    if (!accId) continue
    const prev = result.get(accId) ?? { value: 0, count: 0 }
    prev.value += pos.currentvalueTotal ?? pos.investedTotal
    prev.count += 1
    result.set(accId, prev)
  }

  return result
}

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

  // Investido por conta — para contas tipo "investimento", o saldo reflete os ativos
  const investedByAccount = await getInvestedByAccount(userId)

  return list.map((acc) => {
    // amount positivo = despesa (reduz saldo); negativo = entrada (aumenta saldo)
    const movimento = sumByAccount.get(acc.id) ?? 0
    const invested = investedByAccount.get(acc.id)?.value ?? 0

    // Conta tipo investimento: saldo = investido vinculado + saldo inicial (caixa
    // da corretora não aplicado) - movimentações. Se há ativos vinculados, o
    // valor de mercado domina; senão cai no saldo manual usual.
    if (acc.type === 'investimento' && invested > 0) {
      return { ...acc, currentBalance: acc.initialBalance - movimento + invested }
    }
    return { ...acc, currentBalance: acc.initialBalance - movimento }
  })
}

/**
 * Resumo agregado por conta: cruza contas, transações e investimentos para
 * mostrar, em um só lugar, saldo + total investido + atividade por conta.
 * Faz poucas queries (contas, soma/contagem de transações, investimentos).
 */
export async function getAccountsSummary(userId: string): Promise<AccountSummary[]> {
  const list = await db
    .select({
      id: accounts.id,
      type: accounts.type,
      initialBalance: accounts.initialBalance,
      parentAccountId: accounts.parentAccountId,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))

  if (list.length === 0) return []

  // Soma e contagem de transações por conta (uma query)
  const txAgg = await db
    .select({
      accountId: transactions.accountId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.deletedAt} IS NULL`))
    .groupBy(transactions.accountId)

  const txByAccount = new Map(txAgg.map((t) => [t.accountId, { total: Number(t.total), count: Number(t.count) }]))

  const cardUsageAgg = await db
    .select({
      accountId: transactions.accountId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.kind, 'despesa'), sql`${transactions.deletedAt} IS NULL`))
    .groupBy(transactions.accountId)
  const cardUsageByAccount = new Map(cardUsageAgg.map((t) => [t.accountId, Number(t.total)]))

  // Investido por conta (RV a mercado + RF aplicado) — helper compartilhado
  const investedByAccount = await getInvestedByAccount(userId)

  // Contagem de cartões filhos por conta pai
  const linkedCardCount = new Map<string, number>()
  for (const acc of list) {
    if (acc.parentAccountId) {
      linkedCardCount.set(acc.parentAccountId, (linkedCardCount.get(acc.parentAccountId) ?? 0) + 1)
    }
  }

  return list.map((acc) => {
    const tx = txByAccount.get(acc.id) ?? { total: 0, count: 0 }
    const inv = investedByAccount.get(acc.id) ?? { value: 0, count: 0 }
    const cardUsageCurrent = acc.type === 'cartao' ? cardUsageByAccount.get(acc.id) ?? 0 : 0
    const creditLimit = acc.type === 'cartao' ? acc.creditLimit ?? null : null
    const limitUsagePct = creditLimit && creditLimit > 0
      ? Math.round((cardUsageCurrent / creditLimit) * 10000) / 100
      : null

    return {
      accountId: acc.id,
      currentBalance: acc.initialBalance - tx.total,
      investedCurrent: inv.value,
      investmentCount: inv.count,
      transactionCount: tx.count,
      linkedCardCount: linkedCardCount.get(acc.id) ?? 0,
      cardUsageCurrent,
      creditLimit,
      limitUsagePct,
    }
  })
}

export async function getAccountsOverviewSummary(userId: string): Promise<AccountsOverviewSummary> {
  const [allAccounts, portfolio] = await Promise.all([
    listAccounts(userId),
    getPortfolioSummary(userId),
  ])

  const cardUsageByAccount = new Map<string, number>()
  const cardTxAgg = await db
    .select({
      accountId: transactions.accountId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.kind, 'despesa'),
      sql`${transactions.deletedAt} IS NULL`,
    ))
    .groupBy(transactions.accountId)

  for (const row of cardTxAgg) {
    if (!row.accountId) continue
    cardUsageByAccount.set(row.accountId, Number(row.total))
  }

  const [{ linkedCount }, { orphanCount }] = await Promise.all([
    db
      .select({ linkedCount: sql<number>`COUNT(*)` })
      .from(investments)
      .where(and(eq(investments.userId, userId), sql`${investments.accountId} IS NOT NULL`))
      .then((rows) => ({ linkedCount: Number(rows[0]?.linkedCount ?? 0) })),
    db
      .select({ orphanCount: sql<number>`COUNT(*)` })
      .from(investments)
      .where(and(eq(investments.userId, userId), sql`${investments.accountId} IS NULL`))
      .then((rows) => ({ orphanCount: Number(rows[0]?.orphanCount ?? 0) })),
  ])

  const counts: AccountsOverviewCounts = {
    total: allAccounts.length,
    operational: allAccounts.filter((account) => !account.archived && ['corrente', 'poupanca', 'carteira', 'outro'].includes(account.type)).length,
    archived: allAccounts.filter((account) => account.archived).length,
    cartoes: allAccounts.filter((account) => !account.archived && account.type === 'cartao').length,
    investimentos: allAccounts.filter((account) => !account.archived && account.type === 'investimento').length,
  }

  return buildAccountsOverviewSummary({
    accounts: allAccounts.map((account) => ({
      id: account.id,
      type: account.type,
      initialBalance: account.initialBalance,
      archived: account.archived,
      creditLimit: account.creditLimit,
      currentBalance: account.currentBalance,
    })),
    totalInvested: portfolio.totalInvested,
    cardUsageByAccount,
    linkedInvestmentCount: linkedCount,
    orphanInvestmentCount: orphanCount,
    counts,
  })
}

export async function createAccount(data: CreateAccountData, userId: string): Promise<Account> {
  validate(data, data.type)
  if (!data.name?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome da conta é obrigatório.')

  // Garante que a conta-pai e o dependente informados são do próprio usuário
  await assertAccountOwnership(data.parentAccountId, userId)
  await assertDependentOwnership(data.dependentId, userId)

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
      parentAccountId: data.parentAccountId ?? null,
      dependentId: data.dependentId ?? null,
      userId,
    })
    .returning()

  return created
}

export async function updateAccount(id: string, data: UpdateAccountData, userId: string): Promise<Account> {
  const [existing] = await db
    .select({ id: accounts.id, type: accounts.type, parentAccountId: accounts.parentAccountId })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Conta não encontrada.')

  validate(data, existing.type, id)

  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.type !== undefined) updates.type = data.type
  if (data.initialBalance !== undefined) updates.initialBalance = data.initialBalance
  if (data.color !== undefined) updates.color = data.color
  if (data.closingDay !== undefined) updates.closingDay = data.closingDay
  if (data.dueDay !== undefined) updates.dueDay = data.dueDay
  if (data.creditLimit !== undefined) updates.creditLimit = data.creditLimit
  if (data.parentAccountId !== undefined) {
    await assertAccountOwnership(data.parentAccountId, userId)
    updates.parentAccountId = data.parentAccountId
  }
  if (data.dependentId !== undefined) {
    await assertDependentOwnership(data.dependentId, userId)
    updates.dependentId = data.dependentId
  }
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
