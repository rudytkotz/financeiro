import type { FastifyPluginAsync } from 'fastify'
import {
  listDependents,
  createDependent,
  deleteDependent,
  type ServiceError,
} from '../services/dependentService.js'

// JSON Schema for POST /api/dependents body validation
const createDependentSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
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

const dependentRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/dependents — lista todos os dependentes
  app.get('/api/dependents', async (_request, reply) => {
    const dependentsList = await listDependents()
    return reply.send(dependentsList)
  })

  // POST /api/dependents — cria dependente
  app.post('/api/dependents', { schema: createDependentSchema }, async (request, reply) => {
    const { name } = request.body as { name: string }
    try {
      const dependent = await createDependent(name)
      return reply.status(201).send(dependent)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // DELETE /api/dependents/:id — remove dependente
  app.delete('/api/dependents/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteDependent(id)
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })
}

export default dependentRoutes
