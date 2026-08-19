import {
  pgTable,
  uuid,
  varchar,
  boolean,
  date,
  bigint,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
  },
  (table) => ({
    // Functional unique index on lower(name) for case-insensitive uniqueness.
    // Drizzle 0.30 types only accept PgColumn in .on(), so we cast the SQL
    // expression. The actual generated DDL will be correct.
    nameUniqueIdx: uniqueIndex('categories_name_lower_idx').on(
      sql`lower(${table.name})` as unknown as PgColumn
    ),
  })
)

// ---------------------------------------------------------------------------
// dependents
// ---------------------------------------------------------------------------
export const dependents = pgTable(
  'dependents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
  },
  (table) => ({
    // Functional unique index on lower(name) for case-insensitive uniqueness.
    nameUniqueIdx: uniqueIndex('dependents_name_lower_idx').on(
      sql`lower(${table.name})` as unknown as PgColumn
    ),
  })
)

// ---------------------------------------------------------------------------
// imports  (defined before transactions so FK can reference it)
// ---------------------------------------------------------------------------
export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull().unique(), // YYYY-MM
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  transactionCount: integer('transaction_count').notNull(),
})

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    // Stored as centavos. mode:'number' is safe for centavos
    // (max ~R$ 9.999.999,99 = 999_999_999 which fits in a JS number).
    amount: bigint('amount', { mode: 'number' }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    dependentId: uuid('dependent_id').references(() => dependents.id), // nullable
    source: varchar('source', { length: 10 }).notNull(), // 'csv' | 'manual'
    importId: uuid('import_id').references(() => imports.id), // nullable
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Index on date for efficient month-based filtering
    dateIdx: index('transactions_date_idx').on(table.date),
    // Index on category_id for category filter queries
    categoryIdx: index('transactions_category_id_idx').on(table.categoryId),
    // Index on dependent_id for dependent partitioning queries
    dependentIdx: index('transactions_dependent_id_idx').on(table.dependentId),
    // Index on import_id for import-based queries
    importIdx: index('transactions_import_id_idx').on(table.importId),
  })
)

// ---------------------------------------------------------------------------
// income
// ---------------------------------------------------------------------------
export const income = pgTable('income', {
  id: uuid('id').primaryKey().defaultRandom(),
  month: varchar('month', { length: 7 }).notNull().unique(), // YYYY-MM
  amount: bigint('amount', { mode: 'number' }).notNull(), // centavos
})

// ---------------------------------------------------------------------------
// Type inference helpers (used by services)
// ---------------------------------------------------------------------------
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type Dependent = typeof dependents.$inferSelect
export type NewDependent = typeof dependents.$inferInsert

export type Import = typeof imports.$inferSelect
export type NewImport = typeof imports.$inferInsert

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert

export type Income = typeof income.$inferSelect
export type NewIncome = typeof income.$inferInsert
