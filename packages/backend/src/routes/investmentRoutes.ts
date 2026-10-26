import type { FastifyPluginAsync } from 'fastify'
import {
  listInvestments,
  createRvInvestment,
  createRfInvestment,
  deleteInvestment,
  addTransaction,
  deleteTransaction,
  getRvPositions,
  getPortfolioSummary,
  type ServiceError,
  type CreateRvData,
  type CreateRfData,
  type CreateTxData,
} from '../services/investmentService.js'
import { getQuote } from '../services/quoteService.js'

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
