import type { FastifyPluginAsync } from 'fastify'
import { getIncome, setIncome } from '../services/incomeService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { monthQuerySchema, monthParamSchema, setIncomeSchema } from '../lib/schemas.js'

const incomeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/income', async (request, reply) => {
    const { month } = parse(monthQuerySchema, request.query)
    const record = await getIncome(month, getUserId(request))
    return reply.send(record)
  })

  app.put('/api/income/:month', async (request, reply) => {
    const { month } = parse(monthParamSchema, request.params)
    const { amount } = parse(setIncomeSchema, request.body)
    const record = await setIncome(month, amount, getUserId(request))
    return reply.status(200).send(record)
  })
}

export default incomeRoutes
