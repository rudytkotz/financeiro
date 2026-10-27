import type { FastifyPluginAsync } from 'fastify'
import { getDashboard } from '../services/dashboardService.js'
import { getFinancialHealth } from '../services/projectionService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { dashboardQuerySchema } from '../lib/schemas.js'

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard', async (request, reply) => {
    const { month, dependentId, paymentMethod } = parse(dashboardQuerySchema, request.query)

    // Traduz 'none' para null (transações sem dependente)
    const resolvedDependentId = dependentId === 'none' ? null : dependentId

    const summary = await getDashboard(month, getUserId(request), {
      dependentId: resolvedDependentId,
      paymentMethod: paymentMethod || undefined,
    })
    return reply.send(summary)
  })

  // Saúde financeira + projeção dos próximos meses
  app.get('/api/dashboard/health', async (request, reply) => {
    return reply.send(await getFinancialHealth(getUserId(request)))
  })
}

export default dashboardRoutes
