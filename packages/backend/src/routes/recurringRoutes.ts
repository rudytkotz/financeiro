import type { FastifyPluginAsync } from 'fastify'
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  materializeMonth,
  assertCategoryOwnership,
} from '../services/recurringService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { createRecurringSchema, updateRecurringSchema, idParamSchema, monthQuerySchema } from '../lib/schemas.js'

const recurringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/recurring', async (request, reply) => {
    return reply.send(await listRecurring(getUserId(request)))
  })

  app.post('/api/recurring', async (request, reply) => {
    const data = parse(createRecurringSchema, request.body)
    const userId = getUserId(request)
    await assertCategoryOwnership(data.categoryId, userId)
    const created = await createRecurring(data, userId)
    return reply.status(201).send(created)
  })

  app.put('/api/recurring/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const data = parse(updateRecurringSchema, request.body)
    const userId = getUserId(request)
    await assertCategoryOwnership(data.categoryId, userId)
    const updated = await updateRecurring(id, data, userId)
    return reply.send(updated)
  })

  app.delete('/api/recurring/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteRecurring(id, getUserId(request))
    return reply.status(204).send()
  })

  // Gera as transações recorrentes do mês (idempotente)
  app.post('/api/recurring/materialize', async (request, reply) => {
    const { month } = parse(monthQuerySchema, request.query)
    const created = await materializeMonth(month, getUserId(request))
    return reply.send({ created })
  })
}

export default recurringRoutes
