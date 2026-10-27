import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'
import { env } from '../lib/env.js'

// ---------------------------------------------------------------------------
// Connection pool — DATABASE_URL é validado em lib/env.ts (falha no boot
// se ausente), então aqui já temos a garantia de que existe.
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
})

export const db = drizzle(pool, { schema })

/** Expõe o pool para health checks e encerramento gracioso. */
export const dbPool = pool

export type DB = typeof db
