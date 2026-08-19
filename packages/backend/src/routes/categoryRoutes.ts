import type { FastifyPluginAsync } from 'fastify'
import {
  listCategories,
  createCategory,
  deleteCategory,
  type ServiceError,
} from '../services/categoryService.js'

// JSON Schema for POST /api/categories body validation
const createCategorySchema = {
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

const categoryRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/categories — lista todas as categorias
  app.get('/api/categories', async (_request, reply) => {
    const categories = await listCategories()
    return reply.send(categories)
  })

  // POST /api/categories — cria categoria personalizada
  app.post('/api/categories', { schema: createCategorySchema }, async (request, reply) => {
    const { name } = request.body as { name: string }
    try {
      const category = await createCategory(name)
      return reply.status(201).send(category)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // DELETE /api/categories/:id — remove categoria personalizada
  app.delete('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteCategory(id)
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })
}

export default categoryRoutes
