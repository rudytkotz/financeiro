import type { FastifyPluginAsync } from 'fastify'
import { getIncome, setIncome, type ServiceError } from '../services/incomeService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const incomeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/income', async (request, reply) => {
    const { month } = request.query as { month?: string }
    if (!month) return reply.status(422).send({ code: 'VALIDATION_ERROR', message: 'Parâmetro month obrigatório.' })
    const record = await getIncome(month, getUserId(request))
    return reply.send(record)
  })

  app.put('/api/income/:month', async (request, reply) => {
    const { month } = request.params as { month: string }
    const { amount } = request.body as { amount: number }
    try {
      const record = await setIncome(month, amount, getUserId(request))
      return reply.status(200).send(record)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })
}

export default incomeRoutes
