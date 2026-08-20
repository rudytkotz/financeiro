import type { FastifyPluginAsync } from 'fastify'
import { getDashboard } from '../services/dashboardService.js'

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard', async (request, reply) => {
    const { month } = request.query as { month?: string }
    if (!month) {
      return reply.status(422).send({ code: 'VALIDATION_ERROR', message: 'Parâmetro month obrigatório.' })
    }
    const summary = await getDashboard(month, getUserId(request))
    return reply.send(summary)
  })
}

export default dashboardRoutes
