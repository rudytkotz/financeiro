import type { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users, transactions, categories, dependents } from '../db/schema.js'

const adminRoutes: FastifyPluginAsync = async (app) => {
  // All admin routes require authentication + isAdmin
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const user = request.user as { id: string; isAdmin: boolean }
      if (!user.isAdmin) {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores.' })
      }
    } catch {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token inválido.' })
    }
  })

  // GET /api/admin/users — list all users
  app.get('/api/admin/users', async (_request, reply) => {
    const usersList = await db
      .select({ id: users.id, username: users.username, isAdmin: users.isAdmin, createdAt: users.createdAt })
      .from(users)
      .orderBy(users.username)
    return reply.send(usersList)
  })

  // POST /api/admin/users — create user
  app.post('/api/admin/users', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    if (!username || !password) {
      return reply.status(422).send({ message: 'Username e password são obrigatórios.' })
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username.trim()})`)
      .limit(1)
    if (existing) {
      return reply.status(409).send({ message: 'Usuário já existe.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await db
      .insert(users)
      .values({ username: username.trim(), passwordHash, isAdmin: false })
      .returning()

    return reply.status(201).send({ id: user.id, username: user.username, isAdmin: user.isAdmin })
  })

  // DELETE /api/admin/users/:id — delete user
  app.delete('/api/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Cannot delete self or other admins
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target) return reply.status(404).send({ message: 'Usuário não encontrado.' })
    if (target.isAdmin) return reply.status(422).send({ message: 'Não é possível remover um administrador.' })

    // Delete user's data
    await db.delete(transactions).where(eq(transactions.userId, id))
    await db.delete(categories).where(eq(categories.userId, id))
    await db.delete(dependents).where(eq(dependents.userId, id))
    await db.delete(users).where(eq(users.id, id))

    return reply.status(204).send()
  })

  // GET /api/admin/users/:id/transactions — view user's transactions
  app.get('/api/admin/users/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { month } = request.query as { month?: string }

    let condition = eq(transactions.userId, id)

    const result = await db
      .select()
      .from(transactions)
      .where(condition)
      .orderBy(transactions.date)
      .limit(500)

    return reply.send(result)
  })
}

export default adminRoutes
