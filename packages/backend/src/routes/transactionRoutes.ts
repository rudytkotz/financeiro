import type { FastifyPluginAsync } from 'fastify'
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteAllByMonth,
  associateDependent,
  createTransfer,
  deleteTransfer,
  listDeletedTransactions,
  restoreTransaction,
  purgeTransaction,
} from '../services/transactionService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import {
  createTransactionSchema,
  updateTransactionSchema,
  associateDependentSchema,
  listTransactionsQuerySchema,
  monthQuerySchema,
  idParamSchema,
  createTransferSchema,
} from '../lib/schemas.js'

const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/transactions', async (request, reply) => {
    const query = parse(listTransactionsQuerySchema, request.query)
    const result = await listTransactions(query, getUserId(request))
    return reply.send(result)
  })

  app.post('/api/transactions', async (request, reply) => {
    const body = parse(createTransactionSchema, request.body)
    const transaction = await createTransaction(body, getUserId(request))
    return reply.status(201).send(transaction)
  })

  // Transferência entre contas (cria o par de lançamentos)
  app.post('/api/transactions/transfer', async (request, reply) => {
    const body = parse(createTransferSchema, request.body)
    const result = await createTransfer(body, getUserId(request))
    return reply.status(201).send(result)
  })

  // Remove uma transferência pelas duas pontas
  app.delete('/api/transactions/transfer/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteTransfer(id, getUserId(request))
    return reply.status(204).send()
  })

  // Lixeira (soft delete)
  app.get('/api/transactions/trash', async (request, reply) => {
    return reply.send(await listDeletedTransactions(getUserId(request)))
  })

  app.put('/api/transactions/:id/restore', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await restoreTransaction(id, getUserId(request))
    return reply.status(204).send()
  })

  app.delete('/api/transactions/:id/purge', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await purgeTransaction(id, getUserId(request))
    return reply.status(204).send()
  })

  app.put('/api/transactions/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const body = parse(updateTransactionSchema, request.body)
    const transaction = await updateTransaction(id, body, getUserId(request))
    return reply.status(200).send(transaction)
  })

  app.delete('/api/transactions/bulk', async (request, reply) => {
    const { month } = parse(monthQuerySchema, request.query)
    const count = await deleteAllByMonth(month, getUserId(request))
    return reply.status(200).send({ deleted: count })
  })

  app.delete('/api/transactions/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteTransaction(id, getUserId(request))
    return reply.status(204).send()
  })

  app.put('/api/transactions/:id/dependent', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const body = parse(associateDependentSchema, request.body)
    const result = await associateDependent(id, body, getUserId(request))
    if ('conflict' in result) return reply.status(409).send(result.conflict)
    return reply.status(200).send(result.transaction)
  })
}

export default transactionRoutes
