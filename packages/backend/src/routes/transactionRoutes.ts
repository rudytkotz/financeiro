import type { FastifyPluginAsync } from 'fastify'
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteAllByMonth,
  associateDependent,
  type ServiceError,
  type ListTransactionsParams,
  type CreateTransactionData,
  type UpdateTransactionData,
  type AssociateDependentData,
} from '../services/transactionService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/transactions', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const params: ListTransactionsParams = {}
    if (query.month) params.month = query.month
    if (query.categoryId) params.categoryId = query.categoryId
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    if (query.sort === 'amount_desc' || query.sort === 'date_desc') params.sort = query.sort
    const result = await listTransactions(params, getUserId(request))
    return reply.send(result)
  })

  app.post('/api/transactions', async (request, reply) => {
    const body = request.body as CreateTransactionData
    try {
      const transaction = await createTransaction(body, getUserId(request))
      return reply.status(201).send(transaction)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.put('/api/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as UpdateTransactionData
    try {
      const transaction = await updateTransaction(id, body)
      return reply.status(200).send(transaction)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.delete('/api/transactions/bulk', async (request, reply) => {
    const { month } = request.query as { month?: string }
    if (!month) return reply.status(422).send({ message: 'Parâmetro month obrigatório.' })
    try {
      const count = await deleteAllByMonth(month, getUserId(request))
      return reply.status(200).send({ deleted: count })
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.delete('/api/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteTransaction(id)
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.put('/api/transactions/:id/dependent', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as AssociateDependentData
    try {
      const result = await associateDependent(id, body)
      if ('conflict' in result) return reply.status(409).send(result.conflict)
      return reply.status(200).send(result.transaction)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })
}

export default transactionRoutes
