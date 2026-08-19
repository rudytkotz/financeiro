/**
 * Seed: insere as 9 categorias padrão do sistema.
 *
 * Usage:
 *   npx tsx src/db/seed.ts
 *
 * É idempotente — usa ON CONFLICT DO NOTHING baseado no índice
 * case-insensitive (lower(name)), portanto pode ser reexecutado
 * com segurança a qualquer momento.
 *
 * Requires DATABASE_URL to be set in the environment (or in ../../.env).
 */
import 'dotenv/config'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { categories } from './schema.js'

const DEFAULT_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Educação',
  'Vestuário',
  'Assinaturas',
  'Outros',
] as const

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const db = drizzle(pool)

  console.log('🌱 Seeding default categories…')

  for (const name of DEFAULT_CATEGORIES) {
    // ON CONFLICT on the functional index lower(name) makes this idempotent.
    // Drizzle doesn't natively support functional-index conflict targets yet,
    // so we fall back to raw SQL for the upsert.
    await db.execute(sql`
      INSERT INTO ${categories} ("name", "is_default")
      VALUES (${name}, TRUE)
      ON CONFLICT (lower("name")) DO NOTHING
    `)
  }

  const inserted = await db
    .select({ name: categories.name })
    .from(categories)
    .where(sql`${categories.isDefault} = TRUE`)

  console.log(`✅ Done. Default categories in DB (${inserted.length}):`)
  inserted.forEach((c) => console.log(`   • ${c.name}`))

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
