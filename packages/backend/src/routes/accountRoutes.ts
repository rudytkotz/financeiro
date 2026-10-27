import type { FastifyPluginAsync } from 'fastify'
import { listAccounts, createAccount, updateAccount, deleteAccount } from '../services/accountService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'
import { createAccountSchema, updateAccountSchema, idParamSchema } from '../lib/schemas.js'

const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/accounts', async (request, reply) => {
    return reply.send(await listAccounts(getUserId(request)))
  })

  app.post('/api/accounts', async (request, reply) => {
    const data = parse(createAccountSchema, request.body)
    const account = await createAccount(data, getUserId(request))
    return reply.status(201).send(account)
  })

  app.put('/api/accounts/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    const data = parse(updateAccountSchema, request.body)
    const account = await updateAccount(id, data, getUserId(request))
    return reply.send(account)
  })

  app.delete('/api/accounts/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params)
    await deleteAccount(id, getUserId(request))
    return reply.status(204).send()
  })
}

export default accountRoutes
