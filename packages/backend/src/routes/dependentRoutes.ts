import type { FastifyPluginAsync } from 'fastify'
import { listDependents, createDependent, deleteDependent, setMainDependent, type ServiceError } from '../services/dependentService.js'

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'statusCode' in err && 'code' in err && 'message' in err
}

function getUserId(request: any): string {
  return (request.user as { id: string }).id
}

const dependentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dependents', async (request, reply) => {
    const list = await listDependents(getUserId(request))
    return reply.send(list)
  })

  app.post('/api/dependents', async (request, reply) => {
    const { name } = request.body as { name: string }
    try {
      const dep = await createDependent(name, getUserId(request))
      return reply.status(201).send(dep)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // PUT /api/dependents/:id/main — define como dependente principal (ou remove se já for)
  app.put('/api/dependents/:id/main', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const dep = await setMainDependent(id, getUserId(request))
      return reply.status(200).send(dep)
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })

  // DELETE /api/dependents/main — remove o dependente principal sem setar outro
  app.delete('/api/dependents/main', async (request, reply) => {
    await setMainDependent(null, getUserId(request))
    return reply.status(204).send()
  })

  app.delete('/api/dependents/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await deleteDependent(id, getUserId(request))
      return reply.status(204).send()
    } catch (err) {
      if (isServiceError(err)) return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      throw err
    }
  })
}

export default dependentRoutes
