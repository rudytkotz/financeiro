import type { FastifyPluginAsync } from 'fastify'
import {
  listInvestments,
  createRvInvestment,
  createRfInvestment,
  updateRvInvestment,
  updateRfInvestment,
  deleteInvestment,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getRvPositions,
  getRfPositions,
  getPortfolioSummary,
  getAllocation,
  getEvolution,
  type CreateRvData,
  type CreateRfData,
  type CreateTxData,
  type UpdateRvData,
  type UpdateRfData,
  type UpdateTxData,
} from '../services/investmentService.js'
import { getQuote, getGenericQuote, getDividendHistory } from '../services/quoteService.js'
import {
  addDividend,
  updateDividend,
  deleteDividend,
  getDividendSummary,
  getMaturityAlerts,
  recordSnapshot,
  getSnapshots,
  getAllocationTargets,
  setAllocationTargets,
  getRebalance,
  getTaxReport,
  getDividendForecast,
  type CreateDividendData,
  type UpdateDividendData,
  type SetTargetData,
} from '../services/investmentAdvancedService.js'
import { getUserId } from '../lib/auth.js'

// Nota: a validação detalhada dos payloads de investimento é feita nos services
// (makeError 422). Erros são convertidos em resposta pelo error handler global.

const investmentRoutes: FastifyPluginAsync = async (app) => {
  // Lista todos os investimentos (RF + RV, sem cálculo)
  app.get('/api/investments', async (request, reply) => {
    return reply.send(await listInvestments(getUserId(request)))
  })

  // Posições de renda variável (com preço médio + cotação)
  app.get('/api/investments/positions', async (request, reply) => {
    return reply.send(await getRvPositions(getUserId(request)))
  })

  // Resumo consolidado da carteira
  app.get('/api/investments/summary', async (request, reply) => {
    return reply.send(await getPortfolioSummary(getUserId(request)))
  })

  // Posições de renda fixa (com valor atualizado estimado via CDI)
  app.get('/api/investments/rf-positions', async (request, reply) => {
    return reply.send(await getRfPositions(getUserId(request)))
  })

  // Alocação da carteira (para gráfico de pizza)
  app.get('/api/investments/allocation', async (request, reply) => {
    return reply.send(await getAllocation(getUserId(request)))
  })

  // Evolução do patrimônio vs CDI (para gráfico de linha)
  app.get('/api/investments/evolution', async (request, reply) => {
    return reply.send(await getEvolution(getUserId(request)))
  })

  // ---- Proventos ----
  app.get('/api/investments/dividends', async (request, reply) => {
    return reply.send(await getDividendSummary(getUserId(request)))
  })

  // Projeção de proventos futuros + calendário (via histórico do Yahoo)
  app.get('/api/investments/dividends/forecast', async (request, reply) => {
    return reply.send(await getDividendForecast(getUserId(request)))
  })

  app.post('/api/investments/dividends', async (request, reply) => {
    const div = await addDividend(request.body as CreateDividendData, getUserId(request))
    return reply.status(201).send(div)
  })

  app.put('/api/investments/dividends/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const div = await updateDividend(id, request.body as UpdateDividendData, getUserId(request))
    return reply.send(div)
  })

  app.delete('/api/investments/dividends/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await deleteDividend(id, getUserId(request))
    return reply.status(204).send()
  })

  // Sugestão de dividendos do Yahoo (valor por cota — usuário confirma)
  app.get('/api/investments/dividend-history/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string }
    return reply.send(await getDividendHistory(ticker))
  })

  // ---- Alertas de vencimento ----
  app.get('/api/investments/maturity-alerts', async (request, reply) => {
    return reply.send(await getMaturityAlerts(getUserId(request)))
  })

  // ---- Snapshots / histórico de patrimônio ----
  app.get('/api/investments/snapshots', async (request, reply) => {
    // Grava o snapshot do mês atual e retorna o histórico
    await recordSnapshot(getUserId(request))
    return reply.send(await getSnapshots(getUserId(request)))
  })

  // ---- Rebalanceamento ----
  app.get('/api/investments/targets', async (request, reply) => {
    return reply.send(await getAllocationTargets(getUserId(request)))
  })

  app.put('/api/investments/targets', async (request, reply) => {
    const { targets } = request.body as { targets: SetTargetData[] }
    const saved = await setAllocationTargets(targets ?? [], getUserId(request))
    return reply.send(saved)
  })

  app.get('/api/investments/rebalance', async (request, reply) => {
    return reply.send(await getRebalance(getUserId(request)))
  })

  // ---- Relatório de Imposto de Renda ----
  app.get('/api/investments/tax-report', async (request, reply) => {
    const { year } = request.query as { year?: string }
    const targetYear = year && /^\d{4}$/.test(year) ? parseInt(year, 10) : new Date().getFullYear()
    return reply.send(await getTaxReport(getUserId(request), targetYear))
  })

  // Cotação avulsa de um ticker (usado no autocomplete/preview ao cadastrar).
  // ?generic=1 usa símbolo cru do Yahoo (cripto/moeda), ex: BTC-BRL, USDBRL=X
  app.get('/api/investments/quote/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string }
    const { generic } = request.query as { generic?: string }
    const quote = generic === '1' ? await getGenericQuote(ticker) : await getQuote(ticker)
    if (!quote) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' })
    return reply.send(quote)
  })

  // Criar renda variável
  app.post('/api/investments/rv', async (request, reply) => {
    const inv = await createRvInvestment(request.body as CreateRvData, getUserId(request))
    return reply.status(201).send(inv)
  })

  // Criar renda fixa
  app.post('/api/investments/rf', async (request, reply) => {
    const inv = await createRfInvestment(request.body as CreateRfData, getUserId(request))
    return reply.status(201).send(inv)
  })

  // Editar renda variável
  app.put('/api/investments/rv/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const inv = await updateRvInvestment(id, request.body as UpdateRvData, getUserId(request))
    return reply.send(inv)
  })

  // Editar renda fixa
  app.put('/api/investments/rf/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const inv = await updateRfInvestment(id, request.body as UpdateRfData, getUserId(request))
    return reply.send(inv)
  })

  // Adicionar operação (compra/venda) a um investimento RV
  app.post('/api/investments/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const tx = await addTransaction(id, request.body as CreateTxData, getUserId(request))
    return reply.status(201).send(tx)
  })

  // Editar operação
  app.put('/api/investments/transactions/:txId', async (request, reply) => {
    const { txId } = request.params as { txId: string }
    const tx = await updateTransaction(txId, request.body as UpdateTxData, getUserId(request))
    return reply.send(tx)
  })

  // Deletar operação
  app.delete('/api/investments/transactions/:txId', async (request, reply) => {
    const { txId } = request.params as { txId: string }
    await deleteTransaction(txId, getUserId(request))
    return reply.status(204).send()
  })

  // Deletar investimento
  app.delete('/api/investments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await deleteInvestment(id, getUserId(request))
    return reply.status(204).send()
  })
}

export default investmentRoutes
