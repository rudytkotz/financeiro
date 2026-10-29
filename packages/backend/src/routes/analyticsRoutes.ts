import type { FastifyPluginAsync } from 'fastify'
import {
  getMonthComparison,
  getCashFlowForecast,
  getNetWorthEvolution,
  getYearlyReport,
  searchTransactions,
} from '../services/analyticsService.js'
import { simulateCompound } from '../services/simulatorService.js'
import { getUserId } from '../lib/auth.js'
import type { CompoundSimInput } from '@financeiro/shared'

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  // Comparativo mensal
  app.get('/api/analytics/comparison', async (request, reply) => {
    const { month, lookback } = request.query as { month?: string; lookback?: string }
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)
    const lb = lookback ? Math.min(Math.max(parseInt(lookback, 10) || 3, 1), 12) : 3
    return reply.send(await getMonthComparison(m, getUserId(request), lb))
  })

  // Fluxo de caixa projetado do mês
  app.get('/api/analytics/cashflow', async (request, reply) => {
    const { month } = request.query as { month?: string }
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)
    return reply.send(await getCashFlowForecast(m, getUserId(request)))
  })

  // Evolução patrimonial consolidada
  app.get('/api/analytics/networth', async (request, reply) => {
    const { months } = request.query as { months?: string }
    const n = months ? Math.min(Math.max(parseInt(months, 10) || 12, 3), 36) : 12
    return reply.send(await getNetWorthEvolution(getUserId(request), n))
  })

  // Retrospectiva anual
  app.get('/api/analytics/yearly', async (request, reply) => {
    const { year } = request.query as { year?: string }
    const y = year ? parseInt(year, 10) : new Date().getFullYear()
    return reply.send(await getYearlyReport(y, getUserId(request)))
  })

  // Busca global de transações
  app.get('/api/analytics/search', async (request, reply) => {
    const { q } = request.query as { q?: string }
    return reply.send(await searchTransactions(q ?? '', getUserId(request)))
  })

  // Calculadora de juros compostos / simulação de aportes e dividendos
  app.post('/api/analytics/simulate', async (request, reply) => {
    const body = request.body as Partial<CompoundSimInput>
    const input: CompoundSimInput = {
      initialAmount: Math.max(0, Math.round(Number(body.initialAmount) || 0)),
      monthlyContribution: Math.max(0, Math.round(Number(body.monthlyContribution) || 0)),
      months: Math.min(Math.max(Math.floor(Number(body.months) || 0), 1), 600),
      annualReturnPct: Number(body.annualReturnPct) || 0,
      annualDividendYieldPct: Number(body.annualDividendYieldPct) || 0,
    }
    return reply.send(simulateCompound(input))
  })
}

export default analyticsRoutes
