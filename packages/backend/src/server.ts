import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import { config } from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import dependentRoutes from './routes/dependentRoutes.js'
import importRoutes from './routes/importRoutes.js'
import incomeRoutes from './routes/incomeRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import investmentRoutes from './routes/investmentRoutes.js'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Run migrations before starting server ---
async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  })
  const migrateDb = drizzle(pool)
  const migrationsFolder = path.resolve(__dirname, '../drizzle')
  console.log('⏳ Running migrations from:', migrationsFolder)
  try {
    await migrate(migrateDb, { migrationsFolder })
    console.log('✅ Migrations applied successfully.')
  } catch (err) {
    console.error('❌ Migration error:', err)
  }
  await pool.end()
}

await runMigrations()

const app = Fastify({ logger: true })

// CORS para o frontend em desenvolvimento
await app.register(cors, {
  origin: true,
  credentials: true,
})

// JWT — em produção, o JWT_SECRET é obrigatório. O fallback só é permitido em dev.
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  console.error('❌ JWT_SECRET é obrigatório em produção. Encerrando.')
  process.exit(1)
}
await app.register(fastifyJwt, {
  secret: jwtSecret ?? 'financeiro-dev-secret-only-for-local-development',
})

// Auth hook: protect all /api routes except /api/auth/* and /api/health
app.addHook('onRequest', async (request, reply) => {
  const url = request.url
  if (
    url.startsWith('/api/auth/') ||
    url === '/api/health' ||
    !url.startsWith('/api/')
  ) {
    return // public routes
  }
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token inválido ou ausente.' })
  }
})

// Health check
app.get('/api/health', async () => {
  return { status: 'ok' }
})

// Register route plugins
await app.register(authRoutes)
await app.register(adminRoutes)
await app.register(categoryRoutes)
await app.register(dashboardRoutes)
await app.register(dependentRoutes)
await app.register(importRoutes)
await app.register(incomeRoutes)
await app.register(transactionRoutes)
await app.register(investmentRoutes)

// Servir o frontend como arquivos estáticos (produção)
const fs = await import('fs')
const frontendDist = path.resolve(process.cwd(), 'packages/frontend/dist')
console.log('CWD:', process.cwd())
console.log('Frontend dist path:', frontendDist)
console.log('Dist exists:', fs.existsSync(frontendDist))

if (fs.existsSync(frontendDist)) {
  const files = fs.readdirSync(frontendDist)
  console.log('Dist files:', files)
  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: '/',
  })
  // Disable caching for index.html
  app.addHook('onSend', async (request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.includes('/assets/')) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
  })
  // SPA fallback: rotas não-API retornam index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Not Found' })
    }
    return reply.header('Cache-Control', 'no-cache, no-store, must-revalidate').sendFile('index.html')
  })
} else {
  console.log('Frontend dist not found - running in API-only mode')
}

import { startTelegramBot } from './services/telegramBot.js'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`Backend running on http://${host}:${port}`)
  try {
    startTelegramBot()
  } catch (botErr) {
    console.error('⚠️  Telegram bot failed to start (server continues):', botErr)
  }
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
