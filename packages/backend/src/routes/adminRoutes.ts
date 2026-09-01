import type { FastifyPluginAsync } from 'fastify'
import { eq, sql, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users, transactions, categories, dependents, imports, income } from '../db/schema.js'

const adminRoutes: FastifyPluginAsync = async (app) => {
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

  // GET /api/admin/users
  app.get('/api/admin/users', async (_request, reply) => {
    const usersList = await db
      .select({ id: users.id, username: users.username, isAdmin: users.isAdmin, createdAt: users.createdAt })
      .from(users)
      .orderBy(users.username)
    return reply.send(usersList)
  })

  // GET /api/admin/overview?month=YYYY-MM
  // Retorna, para cada usuário, um resumo financeiro do mês informado.
  app.get('/api/admin/overview', async (request, reply) => {
    const { month } = request.query as { month?: string }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return reply.status(422).send({ message: 'Parâmetro month obrigatório no formato YYYY-MM.' })
    }

    // 1. Buscar todos os usuários (exceto admins para não poluir)
    const allUsers = await db
      .select({ id: users.id, username: users.username, isAdmin: users.isAdmin, createdAt: users.createdAt })
      .from(users)
      .orderBy(users.username)

    // 2. Totais de transações do mês agrupados por userId
    const txTotals = await db
      .select({
        userId: transactions.userId,
        totalAmount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
        txCount: sql<string>`COUNT(*)`,
        refundAmount: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
        expenseAmount: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.referenceMonth, month))
      .groupBy(transactions.userId)

    // 3. Renda do mês por userId
    const incomeByUser = await db
      .select({ userId: income.userId, amount: income.amount })
      .from(income)
      .where(eq(income.month, month))

    // 4. Top 3 categorias por userId no mês
    const topCategories = await db
      .select({
        userId: transactions.userId,
        categoryName: categories.name,
        amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.referenceMonth, month))
      .groupBy(transactions.userId, categories.name)
      .orderBy(sql`SUM(${transactions.amount}) DESC`)

    // 5. Gastos por dependente (mês) agrupado por userId
    const depTotals = await db
      .select({
        userId: transactions.userId,
        dependentName: dependents.name,
        amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(dependents, eq(transactions.dependentId, dependents.id))
      .where(eq(transactions.referenceMonth, month))
      .groupBy(transactions.userId, dependents.name)

    // 6. Contagem de dependentes cadastrados por userId
    const depCounts = await db
      .select({ userId: dependents.userId, total: sql<string>`COUNT(*)` })
      .from(dependents)
      .groupBy(dependents.userId)

    // 7. Última transação por userId
    const lastTx = await db
      .select({ userId: transactions.userId, lastDate: sql<string>`MAX(${transactions.date})` })
      .from(transactions)
      .groupBy(transactions.userId)

    // Montar índices para lookup O(1)
    const txMap = new Map(txTotals.map((r) => [r.userId ?? '__legacy__', r]))
    const incomeMap = new Map(incomeByUser.map((r) => [r.userId ?? '__legacy__', r.amount]))
    const depCountMap = new Map(depCounts.map((r) => [r.userId ?? '__legacy__', Number(r.total)]))
    const lastTxMap = new Map(lastTx.map((r) => [r.userId ?? '__legacy__', r.lastDate]))

    // Top categorias por userId — pegar no máximo 3
    const catMap = new Map<string, Array<{ name: string; amount: number }>>()
    for (const row of topCategories) {
      const key = row.userId ?? '__legacy__'
      if (!catMap.has(key)) catMap.set(key, [])
      const arr = catMap.get(key)!
      if (arr.length < 3) arr.push({ name: row.categoryName, amount: Number(row.amount) })
    }

    // Dependentes por userId
    const depMap = new Map<string, Array<{ name: string; amount: number }>>()
    for (const row of depTotals) {
      const key = row.userId ?? '__legacy__'
      if (!depMap.has(key)) depMap.set(key, [])
      depMap.get(key)!.push({ name: row.dependentName, amount: Number(row.amount) })
    }

    // Montar resultado por usuário
    const overview = allUsers.map((u) => {
      const tx = txMap.get(u.id)
      const incomeAmt = incomeMap.get(u.id) ?? 0
      const totalExpenses = tx ? Number(tx.expenseAmount) : 0
      const totalRefunds = tx ? Number(tx.refundAmount) : 0
      const netAmount = tx ? Number(tx.totalAmount) : 0
      const balance = incomeAmt > 0 ? incomeAmt - totalExpenses : null

      return {
        id: u.id,
        username: u.username,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        month,
        txCount: tx ? Number(tx.txCount) : 0,
        totalExpenses,    // soma apenas positivos (despesas)
        totalRefunds,     // soma apenas negativos (reembolsos) — valor negativo
        netAmount,        // totalExpenses + totalRefunds
        incomeAmount: incomeAmt,
        balance,          // null se renda não cadastrada
        dependentCount: depCountMap.get(u.id) ?? 0,
        lastTransactionDate: lastTxMap.get(u.id) ?? null,
        topCategories: catMap.get(u.id) ?? [],
        expensesByDependent: depMap.get(u.id) ?? [],
      }
    })

    return reply.send(overview)
  })

  // POST /api/admin/users
  app.post('/api/admin/users', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    if (!username || !password) return reply.status(422).send({ message: 'Username e password são obrigatórios.' })

    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${username.trim()})`).limit(1)
    if (existing) return reply.status(409).send({ message: 'Usuário já existe.' })

    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await db.insert(users).values({ username: username.trim(), passwordHash, isAdmin: false }).returning()
    return reply.status(201).send({ id: user.id, username: user.username, isAdmin: user.isAdmin })
  })

  // DELETE /api/admin/users/:id — delete user and all their data
  app.delete('/api/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target) return reply.status(404).send({ message: 'Usuário não encontrado.' })
    if (target.isAdmin) return reply.status(422).send({ message: 'Não é possível remover um administrador.' })

    await db.delete(transactions).where(eq(transactions.userId, id))
    await db.delete(imports).where(eq(imports.userId, id))
    await db.delete(income).where(eq(income.userId, id))
    await db.delete(categories).where(eq(categories.userId, id))
    await db.delete(dependents).where(eq(dependents.userId, id))
    await db.delete(users).where(eq(users.id, id))
    return reply.status(204).send()
  })

  // DELETE /api/admin/users/:id/data — delete all data of a user (keep user account)
  app.delete('/api/admin/users/:id/data', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
    if (!target) return reply.status(404).send({ message: 'Usuário não encontrado.' })

    await db.delete(transactions).where(eq(transactions.userId, id))
    await db.delete(imports).where(eq(imports.userId, id))
    await db.delete(income).where(eq(income.userId, id))
    // Keep categories and dependents as they are reusable
    return reply.status(200).send({ message: 'Dados do usuário apagados.' })
  })

  // DELETE /api/admin/data — delete ALL data from all users (nuclear option)
  app.delete('/api/admin/data', async (_request, reply) => {
    await db.delete(transactions)
    await db.delete(imports)
    await db.delete(income)
    await db.delete(categories).where(sql`${categories.isDefault} = false`)
    await db.delete(dependents)
    return reply.status(200).send({ message: 'Todos os dados foram apagados.' })
  })

  // DELETE /api/admin/transactions — delete only all transactions and imports
  app.delete('/api/admin/transactions', async (_request, reply) => {
    await db.delete(transactions)
    await db.delete(imports)
    return reply.status(200).send({ message: 'Todas as transações foram apagadas.' })
  })

  // GET /api/admin/users/:id/transactions?month=YYYY-MM
  app.get('/api/admin/users/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { month } = request.query as { month?: string }

    const whereClause = month && /^\d{4}-\d{2}$/.test(month)
      ? and(eq(transactions.userId, id), eq(transactions.referenceMonth, month))
      : eq(transactions.userId, id)

    const result = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        paymentMethod: transactions.paymentMethod,
        installmentCurrent: transactions.installmentCurrent,
        installmentTotal: transactions.installmentTotal,
        referenceMonth: transactions.referenceMonth,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(whereClause)
      .orderBy(transactions.date)
      .limit(500)

    return reply.send(result)
  })
}

export default adminRoutes
