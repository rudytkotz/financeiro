import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'

// Load .env from the monorepo root (two levels up from packages/backend)
config({ path: '../../.env' })

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
