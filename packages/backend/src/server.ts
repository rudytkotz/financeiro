import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { config } from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import categoryRoutes from './routes/categoryRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import dependentRoutes from './routes/dependentRoutes.js'
import importRoutes from './routes/importRoutes.js'
import incomeRoutes from './routes/incomeRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = Fastify({ logger: true })

// CORS para o frontend em desenvolvimento
await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
})

// Health check
app.get('/api/health', async () => {
  return { status: 'ok' }
})

// Register route plugins
await app.register(categoryRoutes)
await app.register(dashboardRoutes)
await app.register(dependentRoutes)
await app.register(importRoutes)
await app.register(incomeRoutes)
await app.register(transactionRoutes)

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
    wildcard: false,
  })
  // SPA fallback: rotas não-API retornam index.html
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.sendFile('index.html')
  })
} else {
  console.log('Frontend dist not found - running in API-only mode')
}

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`Backend running on http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
