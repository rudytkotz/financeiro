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
// users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    color: varchar('color', { length: 7 }), // hex color, e.g. '#ef4444', nullable
    userId: uuid('user_id').references(() => users.id),
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
    userId: uuid('user_id').references(() => users.id),
  },
  (table) => ({
    // Unique index composto: unicidade de lower(name) dentro do mesmo usuário.
    // Permite que dois usuários diferentes tenham dependentes com o mesmo nome.
    nameUserUniqueIdx: uniqueIndex('dependents_name_user_lower_idx').on(
      sql`lower(${table.name})` as unknown as PgColumn,
      table.userId as unknown as PgColumn
    ),
  })
)

// ---------------------------------------------------------------------------
// imports  (defined before transactions so FK can reference it)
// ---------------------------------------------------------------------------
export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  transactionCount: integer('transaction_count').notNull(),
  userId: uuid('user_id').references(() => users.id),
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
    categoryId: uuid('category_id').references(() => categories.id), // nullable — preenchido pelo usuário
    dependentId: uuid('dependent_id').references(() => dependents.id), // nullable
    source: varchar('source', { length: 10 }).notNull(), // 'csv' | 'manual'
    importId: uuid('import_id').references(() => imports.id), // nullable
    portador: varchar('portador', { length: 100 }), // nome do portador do cartão (nullable)
    paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('credito'), // credito | pix | debito | dinheiro | outros
    installmentCurrent: integer('installment_current'), // parcela atual (nullable)
    installmentTotal: integer('installment_total'), // total de parcelas (nullable)
    referenceMonth: varchar('reference_month', { length: 7 }), // YYYY-MM — mês em que a transação deve aparecer
    userId: uuid('user_id').references(() => users.id),
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
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  amount: bigint('amount', { mode: 'number' }).notNull(), // centavos
  userId: uuid('user_id').references(() => users.id),
})

// ---------------------------------------------------------------------------
// telegram_links (vinculo chat_id → user)
// ---------------------------------------------------------------------------
export const telegramLinks = pgTable('telegram_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: varchar('chat_id', { length: 50 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Type inference helpers (used by services)
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

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
