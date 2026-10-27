import type { FastifyPluginAsync } from 'fastify'
import { getBudgets, setBudget } from '../services/budgetService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { monthQuerySchema, setBudgetSchema } from '../lib/schemas.js'

const budgetRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/budgets', async (request, reply) => {
    const { month } = parse(monthQuerySchema, request.query)
    return reply.send(await getBudgets(month, getUserId(request)))
  })

  app.put('/api/budgets', async (request, reply) => {
    const { categoryId, month, amount } = parse(setBudgetSchema, request.body)
    await setBudget(categoryId, month, amount, getUserId(request))
    return reply.send(await getBudgets(month, getUserId(request)))
  })
}

export default budgetRoutes
