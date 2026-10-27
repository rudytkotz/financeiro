import type { FastifyPluginAsync } from 'fastify'
import { listDependents, createDependent, deleteDependent, setMainDependent } from '../services/dependentService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { createDependentSchema, idParamSchema } from '../lib/schemas.js'

const dependentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dependents', async (request, reply) => {
    const list = await listDependents(getUserId(request))
    return reply.send(list)
  })

  app.post('/api/dependents', async (request, reply) => {
    const { name } = parse(createDependentSchema, request.body)
    const dep = await createDependent(name, getUserId(request))
    return reply.status(201).send(dep)
  })

  // PUT /api/dependents/:id/main — define como dependente principal (ou remove se já for)
  app.put('/api/dependents/:id/main', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const dep = await setMainDependent(id, getUserId(request))
    return reply.status(200).send(dep)
  })

  // DELETE /api/dependents/main — remove o dependente principal sem setar outro
  app.delete('/api/dependents/main', async (request, reply) => {
    await setMainDependent(null, getUserId(request))
    return reply.status(204).send()
  })

  app.delete('/api/dependents/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteDependent(id, getUserId(request))
    return reply.status(204).send()
  })
}

export default dependentRoutes
