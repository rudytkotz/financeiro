import type { FastifyPluginAsync } from 'fastify'
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  listContributions,
  addContribution,
} from '../services/goalService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { createGoalSchema, updateGoalSchema, addContributionSchema, idParamSchema } from '../lib/schemas.js'

const goalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/goals', async (request, reply) => {
    return reply.send(await listGoals(getUserId(request)))
  })

  app.post('/api/goals', async (request, reply) => {
    const data = parse(createGoalSchema, request.body)
    const goal = await createGoal(data, getUserId(request))
    return reply.status(201).send(goal)
  })

  app.put('/api/goals/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const data = parse(updateGoalSchema, request.body)
    const goal = await updateGoal(id, data, getUserId(request))
    return reply.send(goal)
  })

  app.delete('/api/goals/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteGoal(id, getUserId(request))
    return reply.status(204).send()
  })

  app.get('/api/goals/:id/contributions', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    return reply.send(await listContributions(id, getUserId(request)))
  })

  app.post('/api/goals/:id/contributions', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const data = parse(addContributionSchema, request.body)
    const goal = await addContribution(id, data, getUserId(request))
    return reply.status(201).send(goal)
  })
}

export default goalRoutes
