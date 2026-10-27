import type { FastifyPluginAsync } from 'fastify'
import { getAlerts } from '../services/alertService.js'
import { dispatchAlertsToAllUsers } from '../services/telegramBot.js'
import { getAuthUser, getUserId } from '../lib/auth.js'

const alertRoutes: FastifyPluginAsync = async (app) => {
  // Alertas do usuário autenticado (consumido pelo app)
  app.get('/api/alerts', async (request, reply) => {
    return reply.send(await getAlerts(getUserId(request)))
  })

  // Dispara o envio de alertas via Telegram para todos os usuários vinculados.
  // Restrito a admin (pode ser chamado por um agendador externo autenticado como admin).
  app.post('/api/alerts/dispatch', async (request, reply) => {
    const user = getAuthUser(request)
    if (!user.isAdmin) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'Apenas administradores podem disparar alertas.' })
    }
    const result = await dispatchAlertsToAllUsers()
    return reply.send(result)
  })
}

export default alertRoutes
