import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { registerErrorHandler } from './errorHandler.js'
import { makeError } from './errors.js'
import { parse } from './validation.js'

/**
 * Teste de integração do error handler global + validação Zod.
 * Usa app.inject() — não precisa de banco nem de porta de rede.
 */
describe('errorHandler (integração)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    registerErrorHandler(app)

    const schema = z.object({ amount: z.number().int().positive() })

    app.post('/ok', async (req, reply) => {
      const body = parse(schema, req.body)
      return reply.send({ received: body.amount })
    })

    app.post('/service-error', async () => {
      throw makeError(409, 'CONFLICT', 'Recurso em conflito.')
    })

    app.post('/boom', async () => {
      throw new Error('falha inesperada')
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('retorna 200 quando o corpo é válido', async () => {
    const res = await app.inject({ method: 'POST', url: '/ok', payload: { amount: 50 } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: 50 })
  })

  it('converte ZodError em 422 VALIDATION_ERROR com detalhes', async () => {
    const res = await app.inject({ method: 'POST', url: '/ok', payload: { amount: -1 } })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors.length).toBeGreaterThan(0)
  })

  it('converte ServiceError no status e code corretos', async () => {
    const res = await app.inject({ method: 'POST', url: '/service-error', payload: {} })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'CONFLICT', message: 'Recurso em conflito.' })
  })

  it('erro inesperado vira 500 genérico sem vazar detalhes', async () => {
    const res = await app.inject({ method: 'POST', url: '/boom', payload: {} })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(body.message).not.toContain('falha inesperada')
  })
})
