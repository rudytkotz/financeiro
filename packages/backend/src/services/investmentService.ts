import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { investments, investmentTransactions } from '../db/schema.js'
import type { Investment, InvestmentTransaction } from '../db/schema.js'
import { getQuotes } from './quoteService.js'
import { getCurrentCdiAnnual, getCdiAccumulatedFactor, getCdiMonthlySeries, getIpcaAccumulated12m, getIbovMonthlySeries } from './rateService.js'
import { makeError, type ServiceError } from '../lib/errors.js'

export type { ServiceError }

// ---------------------------------------------------------------------------
// Tipos de posição / resumo (computados)
// ---------------------------------------------------------------------------

export interface RvPosition {
  investment: Investment
  quantity: number
  averagePrice: number       // centavos
  investedTotal: number      // centavos
  currentPrice: number | null
  currentvalueTotal: number | null
  profitLoss: number | null
  profitLossPct: number | null
  transactions: InvestmentTransaction[]
}

export interface PortfolioSummary {
  totalInvested: number
  totalCurrent: number
  totalProfitLoss: number
  totalProfitLossPct: number
  rendaVariavelTotal: number
  rendaFixaTotal: number
}

// ---------------------------------------------------------------------------
// Cálculo de preço médio
// ---------------------------------------------------------------------------

/**
 * Calcula a posição atual (quantidade + preço médio) a partir das operações.
 *
 * Regras:
 *  - Compra: aumenta quantidade e recalcula o preço médio ponderado
 *    (incluindo taxas no custo).
 *  - Venda: reduz a quantidade; o preço médio NÃO muda numa venda
 *    (o PM representa o custo de aquisição do que ainda se tem).
 *  - Se a quantidade zerar, o preço médio volta a 0.
 */
export function computePosition(txs: InvestmentTransaction[]): { quantity: number; averagePrice: number; investedTotal: number } {
  // Ordenar por data crescente para processar na ordem correta
  const ordered = [...txs].sort((a, b) => a.date.localeCompare(b.date))

  let quantity = 0
  let totalCost = 0 // custo total do estoque atual em centavos

  for (const tx of ordered) {
    if (tx.operation === 'compra') {
      const cost = tx.quantity * tx.unitPrice + tx.fees
      totalCost += cost
      quantity += tx.quantity
    } else {
      // venda — reduz quantidade proporcionalmente ao custo médio
      if (quantity > 0) {
        const avgCost = totalCost / quantity
        const soldQty = Math.min(tx.quantity, quantity)
        totalCost -= Math.round(avgCost * soldQty)
        quantity -= soldQty
      }
      if (quantity <= 0) {
        quantity = 0
        totalCost = 0
      }
    }
  }

  const averagePrice = quantity > 0 ? Math.round(totalCost / quantity) : 0
  return { quantity, averagePrice, investedTotal: totalCost }
}

// ---------------------------------------------------------------------------
// CRUD de investimentos
// ---------------------------------------------------------------------------

export async function listInvestments(userId: string): Promise<Investment[]> {
  return db
    .select()
    .from(investments)
    .where(eq(investments.userId, userId))
    .orderBy(asc(investments.name))
}

export interface CreateRvData {
  ticker: string
  name: string
  assetClass: string
  quantity?: number
  unitPrice?: number
  fees?: number
  date?: string
}

export async function createRvInvestment(data: CreateRvData, userId: string): Promise<Investment> {
  const ticker = data.ticker?.trim().toUpperCase() ?? ''
  if (!ticker) throw makeError(422, 'VALIDATION_ERROR', 'O ticker é obrigatório.')
  if (!data.name?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome é obrigatório.')

  const [created] = await db
    .insert(investments)
    .values({
      type: 'renda_variavel',
      ticker,
      name: data.name.trim(),
      assetClass: data.assetClass ?? 'acao',
      userId,
    })
    .returning()

  // Se veio operação inicial, registrar
  if (data.quantity && data.unitPrice && data.date) {
    await db.insert(investmentTransactions).values({
      investmentId: created.id,
      operation: 'compra',
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      fees: data.fees ?? 0,
      date: data.date,
      userId,
    })
  }

  return created
}

export interface CreateRfData {
  name: string
  assetClass: string
  investedAmount: number
  applicationDate: string
  maturityDate?: string | null
  rateType: string
  rateValue: number
}

export async function createRfInvestment(data: CreateRfData, userId: string): Promise<Investment> {
  if (!data.name?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome é obrigatório.')
  if (!data.investedAmount || data.investedAmount <= 0) throw makeError(422, 'VALIDATION_ERROR', 'O valor aplicado deve ser maior que zero.')
  if (!data.applicationDate) throw makeError(422, 'VALIDATION_ERROR', 'A data de aplicação é obrigatória.')
  if (!data.rateType) throw makeError(422, 'VALIDATION_ERROR', 'O tipo de rentabilidade é obrigatório.')

  const [created] = await db
    .insert(investments)
    .values({
      type: 'renda_fixa',
      name: data.name.trim(),
      assetClass: data.assetClass ?? 'outro',
      investedAmount: data.investedAmount,
      applicationDate: data.applicationDate,
      maturityDate: data.maturityDate ?? null,
      rateType: data.rateType,
      rateValue: data.rateValue,
      userId,
    })
    .returning()

  return created
}

export async function deleteInvestment(id: string, userId: string): Promise<void> {
  const [inv] = await db
    .select({ id: investments.id })
    .from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .limit(1)

  if (!inv) throw makeError(404, 'NOT_FOUND', 'Investimento não encontrado.')

  // As operações são deletadas por CASCADE
  await db.delete(investments).where(and(eq(investments.id, id), eq(investments.userId, userId)))
}

// ---------------------------------------------------------------------------
// Edição de investimentos
// ---------------------------------------------------------------------------

export interface UpdateRvData {
  ticker?: string
  name?: string
  assetClass?: string
}

export async function updateRvInvestment(id: string, data: UpdateRvData, userId: string): Promise<Investment> {
  const [inv] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .limit(1)
  if (!inv) throw makeError(404, 'NOT_FOUND', 'Investimento não encontrado.')
  if (inv.type !== 'renda_variavel') throw makeError(422, 'INVALID_TYPE', 'Tipo inválido para esta edição.')

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.ticker !== undefined) {
    const t = data.ticker.trim().toUpperCase()
    if (!t) throw makeError(422, 'VALIDATION_ERROR', 'O ticker é obrigatório.')
    updates.ticker = t
  }
  if (data.name !== undefined) {
    if (!data.name.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome é obrigatório.')
    updates.name = data.name.trim()
  }
  if (data.assetClass !== undefined) updates.assetClass = data.assetClass

  const [updated] = await db
    .update(investments)
    .set(updates)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .returning()
  return updated
}

export interface UpdateRfData {
  name?: string
  assetClass?: string
  investedAmount?: number
  applicationDate?: string
  maturityDate?: string | null
  rateType?: string
  rateValue?: number
}

export async function updateRfInvestment(id: string, data: UpdateRfData, userId: string): Promise<Investment> {
  const [inv] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .limit(1)
  if (!inv) throw makeError(404, 'NOT_FOUND', 'Investimento não encontrado.')
  if (inv.type !== 'renda_fixa') throw makeError(422, 'INVALID_TYPE', 'Tipo inválido para esta edição.')

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) {
    if (!data.name.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome é obrigatório.')
    updates.name = data.name.trim()
  }
  if (data.assetClass !== undefined) updates.assetClass = data.assetClass
  if (data.investedAmount !== undefined) {
    if (!data.investedAmount || data.investedAmount <= 0) throw makeError(422, 'VALIDATION_ERROR', 'O valor aplicado deve ser maior que zero.')
    updates.investedAmount = data.investedAmount
  }
  if (data.applicationDate !== undefined) {
    if (!data.applicationDate) throw makeError(422, 'VALIDATION_ERROR', 'A data de aplicação é obrigatória.')
    updates.applicationDate = data.applicationDate
  }
  if (data.maturityDate !== undefined) updates.maturityDate = data.maturityDate || null
  if (data.rateType !== undefined) updates.rateType = data.rateType
  if (data.rateValue !== undefined) updates.rateValue = data.rateValue

  const [updated] = await db
    .update(investments)
    .set(updates)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)))
    .returning()
  return updated
}

export interface UpdateTxData {
  operation?: 'compra' | 'venda'
  quantity?: number
  unitPrice?: number
  fees?: number
  date?: string
}

export async function updateTransaction(txId: string, data: UpdateTxData, userId: string): Promise<InvestmentTransaction> {
  const [tx] = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.id, txId), eq(investmentTransactions.userId, userId)))
    .limit(1)
  if (!tx) throw makeError(404, 'NOT_FOUND', 'Operação não encontrada.')

  const updates: Record<string, unknown> = {}
  if (data.operation !== undefined) {
    if (data.operation !== 'compra' && data.operation !== 'venda') throw makeError(422, 'VALIDATION_ERROR', 'Operação inválida.')
    updates.operation = data.operation
  }
  if (data.quantity !== undefined) {
    if (!data.quantity || data.quantity <= 0) throw makeError(422, 'VALIDATION_ERROR', 'A quantidade deve ser maior que zero.')
    updates.quantity = data.quantity
  }
  if (data.unitPrice !== undefined) {
    if (!data.unitPrice || data.unitPrice <= 0) throw makeError(422, 'VALIDATION_ERROR', 'O preço unitário deve ser maior que zero.')
    updates.unitPrice = data.unitPrice
  }
  if (data.fees !== undefined) updates.fees = data.fees
  if (data.date !== undefined) {
    if (!data.date) throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória.')
    updates.date = data.date
  }

  const [updated] = await db
    .update(investmentTransactions)
    .set(updates)
    .where(and(eq(investmentTransactions.id, txId), eq(investmentTransactions.userId, userId)))
    .returning()
  return updated
}

// ---------------------------------------------------------------------------
// Operações (compra/venda)
// ---------------------------------------------------------------------------

export interface CreateTxData {
  operation: 'compra' | 'venda'
  quantity: number
  unitPrice: number
  fees?: number
  date: string
}

export async function addTransaction(investmentId: string, data: CreateTxData, userId: string): Promise<InvestmentTransaction> {
  // Verificar ownership do investimento
  const [inv] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.userId, userId)))
    .limit(1)

  if (!inv) throw makeError(404, 'NOT_FOUND', 'Investimento não encontrado.')
  if (inv.type !== 'renda_variavel') throw makeError(422, 'INVALID_TYPE', 'Operações só se aplicam a renda variável.')
  if (data.operation !== 'compra' && data.operation !== 'venda') throw makeError(422, 'VALIDATION_ERROR', 'Operação inválida.')
  if (!data.quantity || data.quantity <= 0) throw makeError(422, 'VALIDATION_ERROR', 'A quantidade deve ser maior que zero.')
  if (!data.unitPrice || data.unitPrice <= 0) throw makeError(422, 'VALIDATION_ERROR', 'O preço unitário deve ser maior que zero.')
  if (!data.date) throw makeError(422, 'VALIDATION_ERROR', 'A data é obrigatória.')

  const [created] = await db
    .insert(investmentTransactions)
    .values({
      investmentId,
      operation: data.operation,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      fees: data.fees ?? 0,
      date: data.date,
      userId,
    })
    .returning()

  return created
}

export async function deleteTransaction(txId: string, userId: string): Promise<void> {
  const [tx] = await db
    .select({ id: investmentTransactions.id })
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.id, txId), eq(investmentTransactions.userId, userId)))
    .limit(1)

  if (!tx) throw makeError(404, 'NOT_FOUND', 'Operação não encontrada.')

  await db.delete(investmentTransactions).where(and(eq(investmentTransactions.id, txId), eq(investmentTransactions.userId, userId)))
}

// ---------------------------------------------------------------------------
// Posições e resumo da carteira
// ---------------------------------------------------------------------------

/**
 * Retorna as posições de renda variável com preço médio e cotação atual.
 */
export async function getRvPositions(userId: string): Promise<RvPosition[]> {
  const rvInvestments = await db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.type, 'renda_variavel')))
    .orderBy(asc(investments.name))

  if (rvInvestments.length === 0) return []

  // Buscar todas as operações desses investimentos de uma vez
  const allTxs = await db
    .select()
    .from(investmentTransactions)
    .where(eq(investmentTransactions.userId, userId))

  const txsByInvestment = new Map<string, InvestmentTransaction[]>()
  for (const tx of allTxs) {
    const arr = txsByInvestment.get(tx.investmentId) ?? []
    arr.push(tx)
    txsByInvestment.set(tx.investmentId, arr)
  }

  // Buscar cotações de todos os tickers de uma vez
  const tickers = rvInvestments.map(i => i.ticker).filter((t): t is string => !!t)
  const quotes = await getQuotes(tickers)

  return rvInvestments.map((investment) => {
    const txs = txsByInvestment.get(investment.id) ?? []
    const { quantity, averagePrice, investedTotal } = computePosition(txs)

    const quote = investment.ticker ? quotes.get(investment.ticker.toUpperCase()) : undefined
    const currentPrice = quote ? Math.round(quote.price * 100) : null // reais → centavos
    const currentvalueTotal = currentPrice !== null ? currentPrice * quantity : null
    const profitLoss = currentvalueTotal !== null ? currentvalueTotal - investedTotal : null
    const profitLossPct = profitLoss !== null && investedTotal > 0
      ? Math.round((profitLoss / investedTotal) * 10000) / 100
      : null

    return {
      investment,
      quantity,
      averagePrice,
      investedTotal,
      currentPrice,
      currentvalueTotal,
      profitLoss,
      profitLossPct,
      transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
    }
  })
}

/**
 * Resumo consolidado da carteira (RF + RV).
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const [rvPositions, rfInvestments] = await Promise.all([
    getRvPositions(userId),
    db.select().from(investments).where(and(eq(investments.userId, userId), eq(investments.type, 'renda_fixa'))),
  ])

  // Renda variável: investido = soma preço médio; atual = soma valor de mercado
  let rvInvested = 0
  let rvCurrent = 0
  for (const pos of rvPositions) {
    rvInvested += pos.investedTotal
    rvCurrent += pos.currentvalueTotal ?? pos.investedTotal // fallback se sem cotação
  }

  // Renda fixa: valor aplicado (rentabilidade projetada fica para v2)
  const rfTotal = rfInvestments.reduce((sum, inv) => sum + (inv.investedAmount ?? 0), 0)

  const totalInvested = rvInvested + rfTotal
  const totalCurrent = rvCurrent + rfTotal
  const totalProfitLoss = totalCurrent - totalInvested
  const totalProfitLossPct = totalInvested > 0
    ? Math.round((totalProfitLoss / totalInvested) * 10000) / 100
    : 0

  return {
    totalInvested,
    totalCurrent,
    totalProfitLoss,
    totalProfitLossPct,
    rendaVariavelTotal: rvCurrent,
    rendaFixaTotal: rfTotal,
  }
}

// ---------------------------------------------------------------------------
// Rentabilidade de renda fixa (valor atualizado via CDI / taxa contratada)
// ---------------------------------------------------------------------------

export interface RfPosition {
  investment: Investment
  investedAmount: number       // centavos
  currentValue: number         // centavos (valor atualizado estimado)
  profitLoss: number           // centavos
  profitLossPct: number
  cdiAnnual: number            // CDI atual usado no cálculo
}

/**
 * Estima o valor atual de um ativo de renda fixa com base na taxa contratada,
 * no CDI acumulado desde a aplicação e no tempo decorrido.
 *
 * - pos_cdi:    rende (rateValue% do CDI) sobre o fator CDI acumulado
 * - prefixado:  rende rateValue% a.a. compostos pro rata
 * - ipca_mais:  aproximado como (IPCA estimado + rateValue%); sem série do IPCA
 *               aqui usamos uma estimativa conservadora usando só o spread + CDI parcial
 *
 * É uma ESTIMATIVA. Valores exatos dependem de marcação a mercado e isenções.
 */
async function estimateRfCurrentValue(inv: Investment): Promise<{ currentValue: number; cdiAnnual: number }> {
  const invested = inv.investedAmount ?? 0
  const cdiAnnual = await getCurrentCdiAnnual()

  if (!inv.applicationDate || invested <= 0 || inv.rateValue === null) {
    return { currentValue: invested, cdiAnnual }
  }

  const today = new Date().toISOString().slice(0, 10)
  const ratePct = inv.rateValue / 100 // rateValue é % * 100

  if (inv.rateType === 'pos_cdi') {
    // Fator CDI acumulado no período × (% do CDI contratado)
    const cdiFactor = await getCdiAccumulatedFactor(inv.applicationDate, today)
    // Ex: 110% do CDI → aplica 110% sobre o rendimento (fator - 1)
    const cdiReturn = cdiFactor - 1
    const contractedReturn = cdiReturn * (ratePct / 100)
    return { currentValue: Math.round(invested * (1 + contractedReturn)), cdiAnnual }
  }

  // prefixado e ipca_mais: compor pro rata pelos dias
  const start = new Date(inv.applicationDate + 'T00:00:00')
  const end = new Date(today + 'T00:00:00')
  const years = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365))

  if (inv.rateType === 'prefixado') {
    const factor = Math.pow(1 + ratePct / 100, years)
    return { currentValue: Math.round(invested * factor), cdiAnnual }
  }

  if (inv.rateType === 'ipca_mais') {
    // IPCA real acumulado 12m (via BC) + spread contratado
    const ipcaAnnual = await getIpcaAccumulated12m()
    const totalRate = ipcaAnnual + ratePct
    const factor = Math.pow(1 + totalRate / 100, years)
    return { currentValue: Math.round(invested * factor), cdiAnnual }
  }

  return { currentValue: invested, cdiAnnual }
}

/**
 * Retorna as posições de renda fixa com valor atualizado estimado.
 */
export async function getRfPositions(userId: string): Promise<RfPosition[]> {
  const rfInvestments = await db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.type, 'renda_fixa')))
    .orderBy(asc(investments.name))

  const positions: RfPosition[] = []
  for (const inv of rfInvestments) {
    const invested = inv.investedAmount ?? 0
    const { currentValue, cdiAnnual } = await estimateRfCurrentValue(inv)
    const profitLoss = currentValue - invested
    const profitLossPct = invested > 0 ? Math.round((profitLoss / invested) * 10000) / 100 : 0
    positions.push({ investment: inv, investedAmount: invested, currentValue, profitLoss, profitLossPct, cdiAnnual })
  }

  return positions
}

// ---------------------------------------------------------------------------
// Alocação da carteira (para gráfico de pizza)
// ---------------------------------------------------------------------------

export interface AllocationSlice {
  label: string
  value: number       // centavos
  category: 'renda_variavel' | 'renda_fixa'
}

export async function getAllocation(userId: string): Promise<AllocationSlice[]> {
  const [rvPositions, rfPositions] = await Promise.all([
    getRvPositions(userId),
    getRfPositions(userId),
  ])

  const slices: AllocationSlice[] = []

  for (const pos of rvPositions) {
    if (pos.quantity <= 0) continue
    const value = pos.currentvalueTotal ?? pos.investedTotal
    if (value > 0) {
      slices.push({ label: pos.investment.ticker ?? pos.investment.name, value, category: 'renda_variavel' })
    }
  }

  for (const pos of rfPositions) {
    if (pos.currentValue > 0) {
      slices.push({ label: pos.investment.name, value: pos.currentValue, category: 'renda_fixa' })
    }
  }

  return slices.sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------------------------------
// Evolução do patrimônio vs CDI (para gráfico de linha)
// ---------------------------------------------------------------------------

export interface EvolutionPoint {
  month: string          // YYYY-MM
  invested: number       // centavos aportados acumulados até o mês
  cdiProjected: number   // centavos: valor que os aportes renderiam no CDI
  ibovProjected: number | null  // centavos: valor que os aportes renderiam no IBOV
}

/**
 * Compara o total aportado ao longo do tempo com o quanto esse mesmo dinheiro
 * teria rendido se aplicado no CDI (100% CDI) a partir de cada aporte.
 *
 * Simplificação: considera os aportes de RV (compras) e as aplicações de RF
 * como fluxos de caixa, e projeta cada um pelo fator CDI até hoje.
 */
export async function getEvolution(userId: string): Promise<EvolutionPoint[]> {
  // Reunir todos os aportes (compras RV + aplicações RF) com data e valor
  const rvTxs = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.operation, 'compra')))

  const rfInvestments = await db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.type, 'renda_fixa')))

  const contributions: Array<{ date: string; amount: number }> = []
  for (const tx of rvTxs) {
    contributions.push({ date: tx.date, amount: tx.quantity * tx.unitPrice + tx.fees })
  }
  for (const inv of rfInvestments) {
    if (inv.applicationDate && inv.investedAmount) {
      contributions.push({ date: inv.applicationDate, amount: inv.investedAmount })
    }
  }

  if (contributions.length === 0) return []

  contributions.sort((a, b) => a.date.localeCompare(b.date))
  const firstDate = contributions[0].date

  // Séries mensais do CDI e do IBOV desde o primeiro aporte
  const [cdiSeries, ibovSeries] = await Promise.all([
    getCdiMonthlySeries(firstDate),
    getIbovMonthlySeries(firstDate),
  ])
  if (cdiSeries.length === 0) return []

  // Mapa mês → fator IBOV acumulado (desde o início)
  const ibovByMonth = new Map(ibovSeries.map((s) => [s.month, s.factor]))
  const hasIbov = ibovSeries.length > 0

  // Fator IBOV acumulado entre dois meses: fator(fim) / fator(início do aporte)
  function ibovFactorBetween(contribMonth: string, targetMonth: string): number {
    const fStart = ibovByMonth.get(contribMonth)
    const fEnd = ibovByMonth.get(targetMonth)
    if (!fStart || !fEnd || fStart <= 0) return 1
    return fEnd / fStart
  }

  const points: EvolutionPoint[] = []

  for (const { month } of cdiSeries) {
    const monthEnd = `${month}-28`
    let investedAccum = 0
    let cdiAccum = 0
    let ibovAccum = 0

    for (const c of contributions) {
      if (c.date <= monthEnd) {
        investedAccum += c.amount
        const factor = await getCdiAccumulatedFactor(c.date, monthEnd)
        cdiAccum += Math.round(c.amount * factor)
        if (hasIbov) {
          const ibovFactor = ibovFactorBetween(c.date.substring(0, 7), month)
          ibovAccum += Math.round(c.amount * ibovFactor)
        }
      }
    }

    points.push({
      month,
      invested: investedAccum,
      cdiProjected: cdiAccum,
      ibovProjected: hasIbov ? ibovAccum : null,
    })
  }

  return points
}
