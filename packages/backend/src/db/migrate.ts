/**
 * Run pending migrations programmatically using Drizzle's migrate helper.
 *
 * Usage:
 *   npx tsx src/db/migrate.ts
 *
 * Requires DATABASE_URL to be set in the environment (or in ../../.env).
 */
import { config } from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../../../../.env') })
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ set' : '✗ missing')

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  })

  const db = drizzle(pool)

  console.log('⏳ Running migrations…')

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../drizzle'),
  })

  console.log('✅ Migrations applied successfully.')

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
