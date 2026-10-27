import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitivos reutilizáveis
// ---------------------------------------------------------------------------

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD.')
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM.')
const uuid = z.string().uuid('Identificador inválido.')
const paymentMethod = z.enum(['credito', 'pix', 'debito', 'dinheiro', 'outros'])
const operationType = z.enum(['despesa', 'reembolso'])
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use formato hex (#rrggbb).')

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

export const createTransactionSchema = z.object({
  date: dateISO,
  description: z.string().trim().min(1, 'A descrição é obrigatória.').max(255),
  amount: z.number().int().refine((n) => n !== 0, 'O valor não pode ser zero.'),
  categoryId: uuid,
  dependentId: uuid.nullable().optional(),
  accountId: uuid.nullable().optional(),
  operationType: operationType.optional(),
  kind: z.enum(['despesa', 'receita']).optional(),
  installmentTotal: z.number().int().min(1).max(24).optional(),
  paymentMethod: paymentMethod.optional(),
})

export const updateTransactionSchema = z.object({
  date: dateISO.optional(),
  description: z.string().trim().min(1).max(255).optional(),
  amount: z.number().int().refine((n) => n !== 0, 'O valor não pode ser zero.').optional(),
  categoryId: uuid.nullable().optional(),
  dependentId: uuid.nullable().optional(),
  accountId: uuid.nullable().optional(),
  paymentMethod: paymentMethod.optional(),
  operationType: operationType.optional(),
})

export const associateDependentSchema = z.object({
  dependentId: uuid.nullable(),
  force: z.boolean().optional(),
})

export const listTransactionsQuerySchema = z.object({
  month: month.optional(),
  categoryId: uuid.optional(),
  startDate: dateISO.optional(),
  endDate: dateISO.optional(),
  sort: z.enum(['amount_desc', 'date_desc']).optional(),
})

export const monthQuerySchema = z.object({
  month: month,
})

export const dashboardQuerySchema = z.object({
  month: month,
  // 'none' = pessoal (sem dependente); uuid = dependente específico
  dependentId: z.union([z.literal('none'), uuid]).optional(),
  paymentMethod: paymentMethod.optional(),
})

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'O nome da categoria é obrigatório.').max(50),
  color: hexColor.nullable().optional(),
})

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: hexColor.nullable().optional(),
})

// ---------------------------------------------------------------------------
// Contas / carteiras
// ---------------------------------------------------------------------------

const accountType = z.enum(['corrente', 'poupanca', 'carteira', 'cartao', 'investimento', 'outro'])
const day = z.number().int().min(1).max(31)

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'O nome da conta é obrigatório.').max(60),
  type: accountType.optional(),
  initialBalance: z.number().int().optional(),
  color: hexColor.nullable().optional(),
  closingDay: day.nullable().optional(),
  dueDay: day.nullable().optional(),
  creditLimit: z.number().int().nonnegative().nullable().optional(),
})

export const updateAccountSchema = createAccountSchema.partial().extend({
  archived: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Dependentes
// ---------------------------------------------------------------------------

export const createDependentSchema = z.object({
  name: z.string().trim().min(1, 'O nome do dependente é obrigatório.').max(50),
})

// ---------------------------------------------------------------------------
// Renda
// ---------------------------------------------------------------------------

export const setIncomeSchema = z.object({
  amount: z.number().int().min(1).max(99_999_999_999),
})

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------

export const setBudgetSchema = z.object({
  categoryId: uuid,
  month: month,
  amount: z.number().int().min(0).max(99_999_999_999),
})

// ---------------------------------------------------------------------------
// Params comuns
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({ id: uuid })
export const monthParamSchema = z.object({ month })

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  username: z.string().trim().min(3, 'Usuário deve ter ao menos 3 caracteres.').max(50),
  password: z.string().min(4, 'Senha deve ter ao menos 4 caracteres.').max(100),
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(4).max(100),
})
