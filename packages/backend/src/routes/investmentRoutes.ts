import type { FastifyPluginAsync } from 'fastify'
import {
  listInvestments,
  createRvInvestment,
  createRfInvestment,
  deleteInvestment,
  addTransaction,
  deleteTransaction,
  getRvPositions,
  getRfPositions,
  getPortfolioSummary,
  getAllocation,
  getEvolution,
  type ServiceError,
  type CreateRvData,
  type CreateRfData,
  type CreateTxData,
} from '../services/investmentService.js'
import { getQuote, getDividendHistory } from '../services/quoteService.js'
import {
  addDividend,
  deleteDividend,
  getDividendSummary,
  getMaturityAlerts,
  recordSnapshot,
  getSnapshots,
  getAllocationTargets,
  setAllocationTargets,
  getRebalance,
  type CreateDividendData,
  type SetTargetData,
} from '../services/investmentAdvancedService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const investmentRoutes: FastifyPluginAsync = async (app) => {
  // Lista todos os investimentos (RF + RV, sem cálculo)
  app.get('/api/investments', async (request, reply) => {
    const list = await listInvestments(getUserId(request))
    return reply.send(list)
  })

  // Posições de renda variável (com preço médio + cotação)
  app.get('/api/investments/positions', async (request, reply) => {
    const positions = await getRvPositions(getUserId(request))
    return reply.send(positions)
  })

  // Resumo consolidado da carteira
  app.get('/api/investments/summary', async (request, reply) => {
    const summary = await getPortfolioSummary(getUserId(request))
    return reply.send(summary)
  })

  // Posições de renda fixa (com valor atualizado estimado via CDI)
  app.get('/api/investments/rf-positions', async (request, reply) => {
    const positions = await getRfPositions(getUserId(request))
    return reply.send(positions)
  })

  // Alocação da carteira (para gráfico de pizza)
  app.get('/api/investments/allocation', async (request, reply) => {
    const allocation = await getAllocation(getUserId(request))
    return reply.send(allocation)
  })

  // Evolução do patrimônio vs CDI (para gráfico de linha)
  app.get('/api/investments/evolution', async (request, reply) => {
    const evolution = await getEvolution(getUserId(request))
    return reply.send(evolution)
  })

  // ---- Proventos ----
  app.get('/api/investments/dividends', async (request, reply) => {
    const summary = await getDividendSummary(getUserId(request))
    return reply.send(summary)
  })

  app.post('/api/investments/dividends', async (request, reply) => {
    try {
      const div = await addDividend(request.body as CreateDividendData, getUserId(request))
      return reply.status(201).send(div)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.delete('/api/investments/dividends/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteDividend(id, getUserId(request))
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // Sugestão de dividendos do Yahoo (valor por cota — usuário confirma)
  app.get('/api/investments/dividend-history/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string }
    const history = await getDividendHistory(ticker)
    return reply.send(history)
  })

  // ---- Alertas de vencimento ----
  app.get('/api/investments/maturity-alerts', async (request, reply) => {
    const alerts = await getMaturityAlerts(getUserId(request))
    return reply.send(alerts)
  })

  // ---- Snapshots / histórico de patrimônio ----
  app.get('/api/investments/snapshots', async (request, reply) => {
    // Grava o snapshot do mês atual e retorna o histórico
    await recordSnapshot(getUserId(request))
    const snapshots = await getSnapshots(getUserId(request))
    return reply.send(snapshots)
  })

  // ---- Rebalanceamento ----
  app.get('/api/investments/targets', async (request, reply) => {
    const targets = await getAllocationTargets(getUserId(request))
    return reply.send(targets)
  })

  app.put('/api/investments/targets', async (request, reply) => {
    try {
      const { targets } = request.body as { targets: SetTargetData[] }
      const saved = await setAllocationTargets(targets ?? [], getUserId(request))
      return reply.send(saved)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.get('/api/investments/rebalance', async (request, reply) => {
    const rebalance = await getRebalance(getUserId(request))
    return reply.send(rebalance)
  })

  // Cotação avulsa de um ticker (usado no autocomplete/preview ao cadastrar)
  app.get('/api/investments/quote/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string }
    const quote = await getQuote(ticker)
    if (!quote) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Cotação não encontrada.' })
    return reply.send(quote)
  })

  // Criar renda variável
  app.post('/api/investments/rv', async (request, reply) => {
    try {
      const inv = await createRvInvestment(request.body as CreateRvData, getUserId(request))
      return reply.status(201).send(inv)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // Criar renda fixa
  app.post('/api/investments/rf', async (request, reply) => {
    try {
      const inv = await createRfInvestment(request.body as CreateRfData, getUserId(request))
      return reply.status(201).send(inv)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // Adicionar operação (compra/venda) a um investimento RV
  app.post('/api/investments/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const tx = await addTransaction(id, request.body as CreateTxData, getUserId(request))
      return reply.status(201).send(tx)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // Deletar operação
  app.delete('/api/investments/transactions/:txId', async (request, reply) => {
    const { txId } = request.params as { txId: string }
    try {
      await deleteTransaction(txId, getUserId(request))
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // Deletar investimento
  app.delete('/api/investments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteInvestment(id, getUserId(request))
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })
}

export default investmentRoutes
