import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { investments, investmentTransactions } from '../db/schema.js'
import type { Investment, InvestmentTransaction } from '../db/schema.js'
import { getQuotes } from './quoteService.js'

export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

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
