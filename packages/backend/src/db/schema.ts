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
    isMain: boolean('is_main').notNull().default(false), // dependente principal do usuário
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
    accountId: uuid('account_id').references(() => accounts.id), // conta/carteira (nullable)
    userId: uuid('user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Index on date for efficient month-based filtering
    dateIdx: index('transactions_date_idx').on(table.date),
    // Composite index for the most common query: list by month + user
    refMonthUserIdx: index('transactions_reference_month_user_idx').on(table.referenceMonth, table.userId),
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
// accounts — contas/carteiras (onde o dinheiro está)
// ---------------------------------------------------------------------------
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 60 }).notNull(),
    // 'corrente' | 'poupanca' | 'carteira' | 'cartao' | 'investimento' | 'outro'
    type: varchar('type', { length: 20 }).notNull().default('corrente'),
    // Saldo inicial em centavos (o saldo atual é calculado: inicial + transações)
    initialBalance: bigint('initial_balance', { mode: 'number' }).notNull().default(0),
    color: varchar('color', { length: 7 }),
    // Cartão de crédito: dia de fechamento e vencimento da fatura, e limite
    closingDay: integer('closing_day'),     // 1-31 (apenas cartão)
    dueDay: integer('due_day'),              // 1-31 (apenas cartão)
    creditLimit: bigint('credit_limit', { mode: 'number' }), // centavos (apenas cartão)
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    userIdx: index('accounts_user_id_idx').on(table.userId),
  })
)

// ---------------------------------------------------------------------------
// investments — ativos de renda fixa e variável
// ---------------------------------------------------------------------------
export const investments = pgTable(
  'investments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 'renda_variavel' | 'renda_fixa'
    type: varchar('type', { length: 20 }).notNull(),
    // Renda variável: ticker da B3 (ex: PETR4, HGLG11). Renda fixa: null
    ticker: varchar('ticker', { length: 20 }),
    // Nome do ativo (ex: 'Petrobras PN' ou 'CDB Banco XP 110% CDI')
    name: varchar('name', { length: 120 }).notNull(),
    // Subtipo para renda variável: 'acao' | 'fii' | 'etf' | 'bdr'
    // Subtipo para renda fixa: 'cdb' | 'tesouro' | 'lci' | 'lca' | 'debenture' | 'outro'
    assetClass: varchar('asset_class', { length: 20 }),

    // --- Campos específicos de renda fixa ---
    // Valor aplicado em centavos (renda fixa)
    investedAmount: bigint('invested_amount', { mode: 'number' }),
    // Data de aplicação (renda fixa)
    applicationDate: date('application_date'),
    // Data de vencimento (renda fixa)
    maturityDate: date('maturity_date'),
    // Tipo de rentabilidade: 'pos_cdi' | 'prefixado' | 'ipca_mais'
    rateType: varchar('rate_type', { length: 20 }),
    // Taxa contratada: para pos_cdi = % do CDI (ex: 110.00); prefixado/ipca = % a.a.
    // Armazenada como basis points * 100 (ex: 110.00% = 11000) para precisão
    rateValue: integer('rate_value'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    userIdx: index('investments_user_id_idx').on(table.userId),
    tickerIdx: index('investments_ticker_idx').on(table.ticker),
  })
)

// ---------------------------------------------------------------------------
// investment_transactions — operações de compra/venda (renda variável)
// ---------------------------------------------------------------------------
export const investmentTransactions = pgTable(
  'investment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investmentId: uuid('investment_id').notNull().references(() => investments.id, { onDelete: 'cascade' }),
    // 'compra' | 'venda'
    operation: varchar('operation', { length: 10 }).notNull(),
    quantity: integer('quantity').notNull(),
    // Preço unitário em centavos
    unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
    // Taxas/corretagem em centavos (opcional)
    fees: bigint('fees', { mode: 'number' }).notNull().default(0),
    date: date('date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    investmentIdx: index('investment_transactions_investment_id_idx').on(table.investmentId),
    userIdx: index('investment_transactions_user_id_idx').on(table.userId),
  })
)

// ---------------------------------------------------------------------------
// investment_dividends — proventos recebidos (dividendos, JCP, rendimentos FII)
// ---------------------------------------------------------------------------
export const investmentDividends = pgTable(
  'investment_dividends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investmentId: uuid('investment_id').notNull().references(() => investments.id, { onDelete: 'cascade' }),
    // 'dividendo' | 'jcp' | 'rendimento' (FII)
    kind: varchar('kind', { length: 15 }).notNull().default('dividendo'),
    // Valor total recebido em centavos
    amount: bigint('amount', { mode: 'number' }).notNull(),
    date: date('date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    investmentIdx: index('investment_dividends_investment_id_idx').on(table.investmentId),
    userIdx: index('investment_dividends_user_id_idx').on(table.userId),
  })
)

// ---------------------------------------------------------------------------
// portfolio_snapshots — fotos mensais do patrimônio (evolução real)
// ---------------------------------------------------------------------------
export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
    totalInvested: bigint('total_invested', { mode: 'number' }).notNull(),
    totalCurrent: bigint('total_current', { mode: 'number' }).notNull(),
    rendaVariavel: bigint('renda_variavel', { mode: 'number' }).notNull().default(0),
    rendaFixa: bigint('renda_fixa', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    // Um snapshot por mês por usuário
    monthUserUniqueIdx: uniqueIndex('portfolio_snapshots_month_user_idx').on(table.month, table.userId),
  })
)

// ---------------------------------------------------------------------------
// allocation_targets — metas de alocação por classe (rebalanceamento)
// ---------------------------------------------------------------------------
export const allocationTargets = pgTable(
  'allocation_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 'acao' | 'fii' | 'etf' | 'bdr' | 'renda_fixa'
    assetClass: varchar('asset_class', { length: 20 }).notNull(),
    // % alvo * 100 (ex: 40.00% = 4000)
    targetPct: integer('target_pct').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (table) => ({
    classUserUniqueIdx: uniqueIndex('allocation_targets_class_user_idx').on(table.assetClass, table.userId),
  })
)

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

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Investment = typeof investments.$inferSelect
export type NewInvestment = typeof investments.$inferInsert

export type InvestmentTransaction = typeof investmentTransactions.$inferSelect
export type NewInvestmentTransaction = typeof investmentTransactions.$inferInsert

export type InvestmentDividend = typeof investmentDividends.$inferSelect
export type NewInvestmentDividend = typeof investmentDividends.$inferInsert

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect
export type NewPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert

export type AllocationTarget = typeof allocationTargets.$inferSelect
export type NewAllocationTarget = typeof allocationTargets.$inferInsert
