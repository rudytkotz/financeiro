import type { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

const registerSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 50 },
      password: { type: 'string', minLength: 4, maxLength: 100 },
    },
    additionalProperties: false,
  },
} as const

const loginSchema = registerSchema

const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/register
  app.post('/api/auth/register', { schema: registerSchema }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }

    // Check duplicate
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username.trim()})`)
      .limit(1)

    if (existing) {
      return reply.status(409).send({ code: 'DUPLICATE_USER', message: 'Usuário já existe.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await db
      .insert(users)
      .values({ username: username.trim(), passwordHash, isAdmin: false })
      .returning()

    const token = app.jwt.sign({ id: user.id, username: user.username, isAdmin: false })
    return reply.status(201).send({ token, user: { id: user.id, username: user.username, isAdmin: false } })
  })

  // POST /api/auth/login
  app.post('/api/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username.trim()})`)
      .limit(1)

    if (!user) {
      return reply.status(401).send({ code: 'INVALID_CREDENTIALS', message: 'Usuário ou senha inválidos.' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ code: 'INVALID_CREDENTIALS', message: 'Usuário ou senha inválidos.' })
    }

    const token = app.jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin })
    return reply.send({ token, user: { id: user.id, username: user.username, isAdmin: user.isAdmin } })
  })

  // GET /api/auth/me — get current user from token
  app.get('/api/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify()
      const payload = request.user as { id: string; username: string; isAdmin: boolean }
      return reply.send(payload)
    } catch {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token inválido.' })
    }
  })
}

export default authRoutes
