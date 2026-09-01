import type { FastifyPluginAsync } from 'fastify'
import { getDashboard } from '../services/dashboardService.js'

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard', async (request, reply) => {
    const { month, dependentId, paymentMethod } = request.query as {
      month?: string
      dependentId?: string   // 'none' = sem dependente (pessoal), uuid = filtrar por dependente
      paymentMethod?: string
    }
    if (!month) {
      return reply.status(422).send({ code: 'VALIDATION_ERROR', message: 'Parâmetro month obrigatório.' })
    }

    // Traduz 'none' para null (transações sem dependente)
    const resolvedDependentId = dependentId === 'none' ? null : dependentId

    const summary = await getDashboard(month, getUserId(request), {
      dependentId: resolvedDependentId,
      paymentMethod: paymentMethod || undefined,
    })
    return reply.send(summary)
  })
}

export default dashboardRoutes
