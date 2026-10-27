import type { FastifyPluginAsync } from 'fastify'
import { listCategories, createCategory, renameCategory, deleteCategory } from '../services/categoryService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { createCategorySchema, updateCategorySchema, idParamSchema } from '../lib/schemas.js'

const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request, reply) => {
    const cats = await listCategories(getUserId(request))
    return reply.send(cats)
  })

  app.post('/api/categories', async (request, reply) => {
    const { name, color } = parse(createCategorySchema, request.body)
    const category = await createCategory(name, getUserId(request), color)
    return reply.status(201).send(category)
  })

  app.put('/api/categories/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const { name, color } = parse(updateCategorySchema, request.body)
    const category = await renameCategory(id, name, getUserId(request), color)
    return reply.status(200).send(category)
  })

  app.delete('/api/categories/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteCategory(id, getUserId(request))
    return reply.status(204).send()
  })
}

export default categoryRoutes
