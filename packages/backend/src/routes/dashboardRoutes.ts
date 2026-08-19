import type { FastifyPluginAsync } from 'fastify'
import { getDashboard } from '../services/dashboardService.js'

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/dashboard?month=YYYY-MM — retorna resumo financeiro do mês
  app.get('/api/dashboard', async (request, reply) => {
    const { month } = request.query as { month?: string }

    if (!month) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'O parâmetro "month" é obrigatório (formato YYYY-MM).',
      })
    }

    const summary = await getDashboard(month)
    return reply.send(summary)
  })
}

export default dashboardRoutes
