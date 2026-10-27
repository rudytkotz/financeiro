import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyJwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { env, jwtSecret, isProduction, isDev } from './lib/env.js'
import { db, dbPool } from './db/index.js'
import { registerErrorHandler } from './lib/errorHandler.js'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import accountRoutes from './routes/accountRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import dependentRoutes from './routes/dependentRoutes.js'
import importRoutes from './routes/importRoutes.js'
import incomeRoutes from './routes/incomeRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import investmentRoutes from './routes/investmentRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Logger — nível e formatação variam por ambiente
// ---------------------------------------------------------------------------
const app = Fastify({
  logger: isDev
    ? { level: 'debug', transport: { target: 'pino-pretty' } }
    : { level: 'info' },
})

// ---------------------------------------------------------------------------
// Migrations antes de subir o servidor
// ---------------------------------------------------------------------------
async function runMigrations() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  })
  const migrateDb = drizzle(pool)
  const migrationsFolder = path.resolve(__dirname, '../drizzle')
  app.log.info(`Executando migrations de: ${migrationsFolder}`)
  try {
    await migrate(migrateDb, { migrationsFolder })
    app.log.info('Migrations aplicadas com sucesso.')
  } catch (err) {
    app.log.error({ err }, 'Erro ao aplicar migrations')
  }
  await pool.end()
}

await runMigrations()

// ---------------------------------------------------------------------------
// Segurança: helmet + CORS + rate limit
// ---------------------------------------------------------------------------
await app.register(helmet, {
  // Em dev o frontend roda em outra porta; não forçamos CSP restritiva aqui
  contentSecurityPolicy: false,
})

// CORS: em produção, restringe à origem do frontend (se configurada).
await app.register(cors, {
  origin: isProduction && env.FRONTEND_URL ? env.FRONTEND_URL : true,
  credentials: true,
})

// Rate limit global, com limite mais rígido aplicado nas rotas de auth.
await app.register(rateLimit, {
  global: false,
  max: 100,
  timeWindow: '1 minute',
})

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
await app.register(fastifyJwt, { secret: jwtSecret })

// Error handler global padronizado
registerErrorHandler(app)

// ---------------------------------------------------------------------------
// Auth hook: protege todas as rotas /api exceto /api/auth/* e /api/health
// ---------------------------------------------------------------------------
app.addHook('onRequest', async (request, reply) => {
  const url = request.url
  if (url.startsWith('/api/auth/') || url === '/api/health' || !url.startsWith('/api/')) {
    return // rotas públicas
  }
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token inválido ou ausente.' })
  }
})

// ---------------------------------------------------------------------------
// Health check — verifica também a conexão com o banco
// ---------------------------------------------------------------------------
app.get('/api/health', async (_request, reply) => {
  try {
    await db.execute(sql`SELECT 1`)
    return { status: 'ok', database: 'up' }
  } catch {
    return reply.status(503).send({ status: 'degraded', database: 'down' })
  }
})

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
await app.register(authRoutes)
await app.register(adminRoutes)
await app.register(accountRoutes)
await app.register(categoryRoutes)
await app.register(dashboardRoutes)
await app.register(dependentRoutes)
await app.register(importRoutes)
await app.register(incomeRoutes)
await app.register(transactionRoutes)
await app.register(investmentRoutes)

// ---------------------------------------------------------------------------
// Frontend estático (produção)
// ---------------------------------------------------------------------------
const fs = await import('fs')
const frontendDist = path.resolve(process.cwd(), 'packages/frontend/dist')

if (fs.existsSync(frontendDist)) {
  app.log.info(`Servindo frontend de: ${frontendDist}`)
  await app.register(fastifyStatic, { root: frontendDist, prefix: '/' })

  // Sem cache no index.html
  app.addHook('onSend', async (request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.includes('/assets/')) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
  })

  // SPA fallback: rotas não-API retornam index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Recurso não encontrado.' })
    }
    return reply.header('Cache-Control', 'no-cache, no-store, must-revalidate').sendFile('index.html')
  })
} else {
  app.log.warn('Frontend dist não encontrado — rodando em modo API-only')
}

// ---------------------------------------------------------------------------
// Encerramento gracioso
// ---------------------------------------------------------------------------
async function shutdown(signal: string) {
  app.log.info(`Recebido ${signal}, encerrando...`)
  try {
    await app.close()
    await dbPool.end()
  } finally {
    process.exit(0)
  }
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
import { startTelegramBot } from './services/telegramBot.js'

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`Backend rodando em http://${env.HOST}:${env.PORT}`)
  try {
    startTelegramBot()
  } catch (botErr) {
    app.log.error({ err: botErr }, 'Telegram bot falhou ao iniciar (servidor continua)')
  }
} catch (err) {
  app.log.error({ err }, 'Falha ao iniciar o servidor')
  process.exit(1)
}
