import type { FastifyPluginAsync } from 'fastify'
import { listCategories, createCategory, deleteCategory, type ServiceError } from '../services/categoryService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request, reply) => {
    const categories = await listCategories(getUserId(request))
    return reply.send(categories)
  })

  app.post('/api/categories', async (request, reply) => {
    const { name } = request.body as { name: string }
    try {
      const category = await createCategory(name, getUserId(request))
      return reply.status(201).send(category)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.delete('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteCategory(id, getUserId(request))
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })
}

export default categoryRoutes
