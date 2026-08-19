import type { FastifyPluginAsync } from 'fastify'
import {
  getIncome,
  setIncome,
  type ServiceError,
} from '../services/incomeService.js'

// JSON Schema for PUT /api/income/:month body validation
const setIncomeSchema = {
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number' },
    },
    additionalProperties: false,
  },
} as const

function isServiceError(err: unknown): err is ServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    'message' in err
  )
}

const incomeRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/income?month=YYYY-MM — retorna a renda do mês ou null
  app.get('/api/income', async (request, reply) => {
    const { month } = request.query as { month?: string }

    if (!month) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'O parâmetro "month" é obrigatório (formato YYYY-MM).',
      })
    }

    const record = await getIncome(month)
    return reply.send(record)
  })

  // PUT /api/income/:month — body: { amount: number }; cria ou atualiza renda do mês
  app.put('/api/income/:month', { schema: setIncomeSchema }, async (request, reply) => {
    const { month } = request.params as { month: string }
    const { amount } = request.body as { amount: number }

    try {
      const record = await setIncome(month, amount)
      return reply.status(200).send(record)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })
}

export default incomeRoutes
