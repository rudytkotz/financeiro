import { eq, and, asc, desc, gte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { investments, investmentDividends, portfolioSnapshots, allocationTargets } from '../db/schema.js'
import type { InvestmentDividend, PortfolioSnapshot, AllocationTarget } from '../db/schema.js'
import { getRvPositions, getPortfolioSummary, type RvPosition } from './investmentService.js'
import { getRfPositions } from './investmentService.js'

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}
function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

// ---------------------------------------------------------------------------
// Proventos (dividendos / JCP / rendimentos)
// ---------------------------------------------------------------------------

export interface CreateDividendData {
  investmentId: string
  kind?: 'dividendo' | 'jcp' | 'rendimento'
  amount: number   // centavos (total recebido)
  date: string
}

export async function addDividend(data: CreateDividendData, userId: string): Promise<InvestmentDividend> {
  const [inv] = await db
    .select({ id: investments.id })
    .from(investments)
    .where(and(eq(investments.id, data.investmentId), eq(investments.userId, userId)))
    .limit(1)
  if (!inv) throw makeError(404, 'NOT_FOUND', 'Investimento não encontrado.')
  if (!data.amount || data.amount <= 0) throw makeError(422, 'VALIDATION_ERROR', 'O valor deve ser maior que zero.')
  if (!data.date) throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória.')

  const [created] = await db
    .insert(investmentDividends)
    .values({
      investmentId: data.investmentId,
      kind: data.kind ?? 'dividendo',
      amount: data.amount,
      date: data.date,
      userId,
    })
    .returning()
  return created
}

export async function deleteDividend(id: string, userId: string): Promise<void> {
  const [div] = await db
    .select({ id: investmentDividends.id })
    .from(investmentDividends)
    .where(and(eq(investmentDividends.id, id), eq(investmentDividends.userId, userId)))
    .limit(1)
  if (!div) throw makeError(404, 'NOT_FOUND', 'Provento não encontrado.')
  await db.delete(investmentDividends).where(and(eq(investmentDividends.id, id), eq(investmentDividends.userId, userId)))
}

export interface DividendSummary {
  dividends: Array<InvestmentDividend & { investmentName: string; ticker: string | null }>
  totalReceived: number           // centavos (todos)
  totalLast12m: number            // centavos (últimos 12 meses)
  byMonth: Array<{ month: string; amount: number }>  // últimos 12 meses
  portfolioYield: number          // dividend yield da carteira (% últimos 12m / valor atual)
  yieldOnCost: number             // yield on cost (% últimos 12m / total investido)
}

export async function getDividendSummary(userId: string): Promise<DividendSummary> {
  const rows = await db
    .select({
      id: investmentDividends.id,
      investmentId: investmentDividends.investmentId,
      kind: investmentDividends.kind,
      amount: investmentDividends.amount,
      date: investmentDividends.date,
      createdAt: investmentDividends.createdAt,
      userId: investmentDividends.userId,
      investmentName: investments.name,
      ticker: investments.ticker,
    })
    .from(investmentDividends)
    .innerJoin(investments, eq(investmentDividends.investmentId, investments.id))
    .where(eq(investmentDividends.userId, userId))
    .orderBy(desc(investmentDividends.date))

  const totalReceived = rows.reduce((s, r) => s + r.amount, 0)

  // Últimos 12 meses
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)
  const last12 = rows.filter((r) => r.date >= cutoff)
  const totalLast12m = last12.reduce((s, r) => s + r.amount, 0)

  // Agrupar por mês (últimos 12)
  const byMonthMap = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    byMonthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0)
  }
  for (const r of last12) {
    const m = r.date.substring(0, 7)
    if (byMonthMap.has(m)) byMonthMap.set(m, (byMonthMap.get(m) ?? 0) + r.amount)
  }
  const byMonth = [...byMonthMap.entries()].map(([month, amount]) => ({ month, amount }))

  // Yields — precisam do valor atual e investido da carteira
  const summary = await getPortfolioSummary(userId)
  const portfolioYield = summary.totalCurrent > 0 ? Math.round((totalLast12m / summary.totalCurrent) * 10000) / 100 : 0
  const yieldOnCost = summary.totalInvested > 0 ? Math.round((totalLast12m / summary.totalInvested) * 10000) / 100 : 0

  return {
    dividends: rows as DividendSummary['dividends'],
    totalReceived,
    totalLast12m,
    byMonth,
    portfolioYield,
    yieldOnCost,
  }
}

// ---------------------------------------------------------------------------
// Alertas de vencimento (renda fixa)
// ---------------------------------------------------------------------------

export interface MaturityAlert {
  investmentId: string
  name: string
  maturityDate: string
  daysUntil: number
  investedAmount: number
}

/**
 * Retorna ativos de RF vencendo nos próximos N dias (padrão 60).
 */
export async function getMaturityAlerts(userId: string, withinDays = 60): Promise<MaturityAlert[]> {
  const rfInvestments = await db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.type, 'renda_fixa')))

  const today = new Date()
  const alerts: MaturityAlert[] = []

  for (const inv of rfInvestments) {
    if (!inv.maturityDate) continue
    const maturity = new Date(inv.maturityDate + 'T00:00:00')
    const daysUntil = Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil >= 0 && daysUntil <= withinDays) {
      alerts.push({
        investmentId: inv.id,
        name: inv.name,
        maturityDate: inv.maturityDate,
        daysUntil,
        investedAmount: inv.investedAmount ?? 0,
      })
    }
  }

  return alerts.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ---------------------------------------------------------------------------
// Snapshots mensais do patrimônio
// ---------------------------------------------------------------------------

/**
 * Grava (ou atualiza) o snapshot do mês corrente com o estado atual da carteira.
 * Idempotente — um snapshot por mês. Chamado ao abrir a página de investimentos.
 */
export async function recordSnapshot(userId: string): Promise<void> {
  const summary = await getPortfolioSummary(userId)
  // Só grava se houver patrimônio
  if (summary.totalCurrent <= 0 && summary.totalInvested <= 0) return

  const month = new Date().toISOString().slice(0, 7)

  await db
    .insert(portfolioSnapshots)
    .values({
      month,
      totalInvested: summary.totalInvested,
      totalCurrent: summary.totalCurrent,
      rendaVariavel: summary.rendaVariavelTotal,
      rendaFixa: summary.rendaFixaTotal,
      userId,
    })
    .onConflictDoUpdate({
      target: [portfolioSnapshots.month, portfolioSnapshots.userId],
      set: {
        totalInvested: summary.totalInvested,
        totalCurrent: summary.totalCurrent,
        rendaVariavel: summary.rendaVariavelTotal,
        rendaFixa: summary.rendaFixaTotal,
      },
    })
}

export async function getSnapshots(userId: string): Promise<PortfolioSnapshot[]> {
  return db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.userId, userId))
    .orderBy(asc(portfolioSnapshots.month))
}

// ---------------------------------------------------------------------------
// Rebalanceamento — metas de alocação
// ---------------------------------------------------------------------------

export async function getAllocationTargets(userId: string): Promise<AllocationTarget[]> {
  return db
    .select()
    .from(allocationTargets)
    .where(eq(allocationTargets.userId, userId))
}

export interface SetTargetData {
  assetClass: string
  targetPct: number  // % * 100
}

/**
 * Define/atualiza as metas de alocação (substitui todas de uma vez).
 */
export async function setAllocationTargets(targets: SetTargetData[], userId: string): Promise<AllocationTarget[]> {
  const total = targets.reduce((s, t) => s + t.targetPct, 0)
  if (total > 10000) throw makeError(422, 'VALIDATION_ERROR', 'A soma das metas não pode ultrapassar 100%.')

  // Apagar as atuais e inserir as novas
  await db.delete(allocationTargets).where(eq(allocationTargets.userId, userId))
  if (targets.length > 0) {
    await db.insert(allocationTargets).values(
      targets
        .filter((t) => t.targetPct > 0)
        .map((t) => ({ assetClass: t.assetClass, targetPct: t.targetPct, userId }))
    )
  }
  return getAllocationTargets(userId)
}

export interface RebalanceRow {
  assetClass: string
  currentValue: number   // centavos
  currentPct: number
  targetPct: number
  diffPct: number        // atual - alvo
  suggestedAmount: number // centavos a aportar (+) ou resgatar (-) para atingir alvo
}

/**
 * Calcula o desvio da carteira em relação às metas e sugere aportes.
 */
export async function getRebalance(userId: string): Promise<RebalanceRow[]> {
  const [targets, rvPositions, rfPositions] = await Promise.all([
    getAllocationTargets(userId),
    getRvPositions(userId),
    getRfPositions(userId),
  ])

  if (targets.length === 0) return []

  // Valor atual por classe
  const byClass = new Map<string, number>()
  for (const pos of rvPositions as RvPosition[]) {
    if (pos.quantity <= 0) continue
    const cls = pos.investment.assetClass ?? 'outro'
    byClass.set(cls, (byClass.get(cls) ?? 0) + (pos.currentvalueTotal ?? pos.investedTotal))
  }
  let rfTotal = 0
  for (const pos of rfPositions) rfTotal += pos.currentValue
  if (rfTotal > 0) byClass.set('renda_fixa', rfTotal)

  const totalValue = [...byClass.values()].reduce((s, v) => s + v, 0)
  if (totalValue <= 0) return []

  return targets.map((t) => {
    const currentValue = byClass.get(t.assetClass) ?? 0
    const currentPct = Math.round((currentValue / totalValue) * 10000) / 100
    const targetPct = t.targetPct / 100
    const targetValue = Math.round((targetPct / 100) * totalValue)
    const suggestedAmount = targetValue - currentValue
    return {
      assetClass: t.assetClass,
      currentValue,
      currentPct,
      targetPct,
      diffPct: Math.round((currentPct - targetPct) * 100) / 100,
      suggestedAmount,
    }
  })
}
