import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { postImportsSchema } from './importRoutes.js'

describe('importRoutes schema', () => {
  it('aceita payload do frontend com categoryId nulo e campos de importação', async () => {
    const app = Fastify()

    app.post('/api/imports', { schema: postImportsSchema }, async (_request, reply) => {
      return reply.send({ ok: true })
    })

    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: {
        transactions: [
          {
            date: '2026-11-01',
            description: 'MONTECASEROS',
            amount: 5000,
            categoryId: null,
            dependentId: null,
            source: 'csv',
            importId: null,
            portador: 'RUDY TKOTZ',
            installmentCurrent: null,
            installmentTotal: null,
          },
        ],
        referenceMonth: '2026-11',
        force: false,
        accountId: null,
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    await app.close()
  })
})
