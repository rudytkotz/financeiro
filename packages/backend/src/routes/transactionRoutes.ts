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
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    'message' in err
  )
}

const createTransactionSchema = {
  body: {
    type: 'object',
    required: ['date', 'description', 'amount', 'categoryId'],
    properties: {
      date: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      categoryId: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const

const updateTransactionSchema = {
  body: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
      categoryId: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const

const associateDependentSchema = {
  body: {
    type: 'object',
    required: ['dependentId'],
    properties: {
      dependentId: { type: ['string', 'null'] },
      force: { type: 'boolean' },
    },
    additionalProperties: false,
  },
} as const

const transactionRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/transactions — listagem com filtros
  app.get('/api/transactions', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>

    const params: ListTransactionsParams = {}

    if (query.month) params.month = query.month
    if (query.categoryId) params.categoryId = query.categoryId
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    if (query.sort === 'amount_desc' || query.sort === 'date_desc') {
      params.sort = query.sort
    }

    const result = await listTransactions(params)
    return reply.send(result)
  })

  // POST /api/transactions — criação manual
  app.post('/api/transactions', { schema: createTransactionSchema }, async (request, reply) => {
    const body = request.body as CreateTransactionData
    try {
      const transaction = await createTransaction(body)
      return reply.status(201).send(transaction)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // PUT /api/transactions/:id — edição
  app.put('/api/transactions/:id', { schema: updateTransactionSchema }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as UpdateTransactionData
    try {
      const transaction = await updateTransaction(id, body)
      return reply.status(200).send(transaction)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // DELETE /api/transactions/bulk?month=YYYY-MM — exclui todas do mês
  app.delete('/api/transactions/bulk', async (request, reply) => {
    const { month } = request.query as { month?: string }
    if (!month) {
      return reply.status(422).send({ code: 'VALIDATION_ERROR', message: 'Parâmetro month é obrigatório.' })
    }
    try {
      const count = await deleteAllByMonth(month)
      return reply.status(200).send({ deleted: count })
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // DELETE /api/transactions/:id — exclusão
  app.delete('/api/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteTransaction(id)
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // PUT /api/transactions/:id/dependent — associar/desassociar dependente
  app.put('/api/transactions/:id/dependent', { schema: associateDependentSchema }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as AssociateDependentData
    try {
      const result = await associateDependent(id, body)
      if ('conflict' in result) {
        return reply.status(409).send(result.conflict)
      }
      return reply.status(200).send(result.transaction)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })
}

export default transactionRoutes
