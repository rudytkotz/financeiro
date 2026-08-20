// Domínio principal

export interface Transaction {
  id: string
  date: string           // ISO 8601 YYYY-MM-DD
  description: string    // max 255 chars
  amount: number         // centavos (integer, negativo = reembolso)
  categoryId: string
  dependentId: string | null
  source: 'csv' | 'manual'
  importId: string | null
  portador: string | null
  paymentMethod: string  // 'credito' | 'pix' | 'debito' | 'dinheiro' | 'outros'
  installmentCurrent: number | null
  installmentTotal: number | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string           // max 50 chars
  isDefault: boolean
}

export interface Dependent {
  id: string
  name: string           // max 50 chars
}

export interface Income {
  id: string
  month: string          // YYYY-MM
  amount: number         // positivo, centavos (integer)
}

export interface Import {
  id: string
  referenceMonth: string // YYYY-MM
  importedAt: string
  transactionCount: number
}

// Dashboard

export interface DashboardSummary {
  month: string
  totalExpenses: number
  totalUserExpenses: number
  incomeAmount: number | null
  balance: number | null
  expensesByCategory: Array<{
    categoryId: string
    categoryName: string
    amount: number
    percentage: number
  }>
  expensesByDependent: Array<{
    dependentId: string
    dependentName: string
    amount: number
  }>
  expensesByPaymentMethod: Array<{
    paymentMethod: string
    amount: number
    count: number
  }>
}

// CSV Parse

export interface CsvParseResult {
  valid: Transaction[]
  invalidCount: number
  invalidReasons: Array<{ line: number; reason: string }>
}

// API Payloads

export interface CreateTransactionPayload {
  date: string
  description: string
  amount: number         // centavos
  categoryId: string
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {
  paymentMethod?: string
}

export interface SetDependentPayload {
  dependentId: string | null
  force?: boolean
}

export interface CreateCategoryPayload {
  name: string
}

export interface CreateDependentPayload {
  name: string
}

export interface SetIncomePayload {
  amount: number         // centavos
}

export interface SaveImportPayload {
  transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]
  force?: boolean
}

// API Responses

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export interface DuplicateImportError extends ApiError {
  isDuplicate: true
  referenceMonth: string
}

export interface ConflictDependentError extends ApiError {
  requiresConfirmation: true
}
