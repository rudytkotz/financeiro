import type { FastifyPluginAsync } from 'fastify'
import { listCategories, createCategory, renameCategory, deleteCategory, type ServiceError } from '../services/categoryService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request, reply) => {
    const cats = await listCategories(getUserId(request))
    return reply.send(cats)
  })

  app.post('/api/categories', async (request, reply) => {
    const { name, color } = request.body as { name: string; color?: string | null }
    try {
      const category = await createCategory(name, getUserId(request), color)
      return reply.status(201).send(category)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  app.put('/api/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name, color } = request.body as { name: string; color?: string | null }
    try {
      const category = await renameCategory(id, name, getUserId(request), color)
      return reply.status(200).send(category)
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
