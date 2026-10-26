// Domínio principal

export interface Transaction {
  id: string
  date: string           // ISO 8601 YYYY-MM-DD
  description: string    // max 255 chars
  amount: number         // centavos (integer, negativo = reembolso)
  categoryId: string | null
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
  color: string | null   // hex color, e.g. '#ef4444'
}

export interface Dependent {
  id: string
  name: string           // max 50 chars
  isMain: boolean        // dependente principal do usuário
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

// Investimentos

export type InvestmentType = 'renda_variavel' | 'renda_fixa'
export type RvAssetClass = 'acao' | 'fii' | 'etf' | 'bdr'
export type RfAssetClass = 'cdb' | 'tesouro' | 'lci' | 'lca' | 'debenture' | 'outro'
export type RateType = 'pos_cdi' | 'prefixado' | 'ipca_mais'

export interface Investment {
  id: string
  type: InvestmentType
  ticker: string | null
  name: string
  assetClass: string | null
  investedAmount: number | null    // centavos (renda fixa)
  applicationDate: string | null   // YYYY-MM-DD (renda fixa)
  maturityDate: string | null      // YYYY-MM-DD (renda fixa)
  rateType: string | null          // 'pos_cdi' | 'prefixado' | 'ipca_mais'
  rateValue: number | null         // % * 100 (ex: 110.00% = 11000)
  createdAt: string
  updatedAt: string
}

export interface InvestmentTransaction {
  id: string
  investmentId: string
  operation: 'compra' | 'venda'
  quantity: number
  unitPrice: number   // centavos
  fees: number        // centavos
  date: string        // YYYY-MM-DD
  createdAt: string
}

// Cotação atual (via brapi.dev)
export interface Quote {
  ticker: string
  price: number          // em reais (float), vem da API
  change: number         // variação % do dia
  previousClose: number
  name: string | null
  updatedAt: string | null
}

// Posição consolidada de renda variável (calculada)
export interface RvPosition {
  investment: Investment
  quantity: number           // quantidade atual em carteira
  averagePrice: number       // preço médio em centavos
  investedTotal: number      // total investido em centavos (qtd * pm)
  currentPrice: number | null   // cotação atual em centavos
  currentvalueTotal: number | null // valor atual em centavos
  profitLoss: number | null     // lucro/prejuízo em centavos
  profitLossPct: number | null  // lucro/prejuízo em %
  transactions: InvestmentTransaction[]
}

// Resumo consolidado da carteira
export interface PortfolioSummary {
  totalInvested: number          // centavos (RF aplicado + RV ao preço médio)
  totalCurrent: number           // centavos (RF aplicado + RV ao valor de mercado)
  totalProfitLoss: number        // centavos
  totalProfitLossPct: number
  rendaVariavelTotal: number     // centavos (valor de mercado)
  rendaFixaTotal: number         // centavos (valor aplicado)
}

// Posição de renda fixa (com valor atualizado estimado)
export interface RfPosition {
  investment: Investment
  investedAmount: number       // centavos
  currentValue: number         // centavos
  profitLoss: number           // centavos
  profitLossPct: number
  cdiAnnual: number            // CDI atual (% a.a.)
}

// Alocação da carteira (gráfico de pizza)
export interface AllocationSlice {
  label: string
  value: number       // centavos
  category: 'renda_variavel' | 'renda_fixa'
}

// Evolução patrimônio vs CDI vs IBOV (gráfico de linha)
export interface EvolutionPoint {
  month: string          // YYYY-MM
  invested: number       // centavos aportados acumulados
  cdiProjected: number   // centavos: valor projetado no CDI
  ibovProjected: number | null  // centavos: valor projetado no IBOV
}

// Proventos
export interface InvestmentDividend {
  id: string
  investmentId: string
  kind: string           // 'dividendo' | 'jcp' | 'rendimento'
  amount: number         // centavos
  date: string           // YYYY-MM-DD
  createdAt: string
  investmentName: string
  ticker: string | null
}

export interface DividendSummary {
  dividends: InvestmentDividend[]
  totalReceived: number
  totalLast12m: number
  byMonth: Array<{ month: string; amount: number }>
  portfolioYield: number    // dividend yield da carteira (%)
  yieldOnCost: number       // yield on cost (%)
}

export interface CreateDividendPayload {
  investmentId: string
  kind?: 'dividendo' | 'jcp' | 'rendimento'
  amount: number    // centavos
  date: string
}

export interface DividendHistoryEvent {
  date: string      // YYYY-MM-DD
  amount: number    // reais por cota
}

// Alertas de vencimento (RF)
export interface MaturityAlert {
  investmentId: string
  name: string
  maturityDate: string
  daysUntil: number
  investedAmount: number
}

// Snapshot mensal do patrimônio
export interface PortfolioSnapshot {
  id: string
  month: string          // YYYY-MM
  totalInvested: number
  totalCurrent: number
  rendaVariavel: number
  rendaFixa: number
  createdAt: string
}

// Rebalanceamento
export interface AllocationTarget {
  id: string
  assetClass: string
  targetPct: number      // % * 100
  userId?: string
}

export interface RebalanceRow {
  assetClass: string
  currentValue: number
  currentPct: number
  targetPct: number
  diffPct: number
  suggestedAmount: number
}

export interface SetTargetPayload {
  assetClass: string
  targetPct: number      // % * 100
}

// Relatório de Imposto de Renda
export interface TaxMonthRow {
  month: string          // YYYY-MM
  assetClass: string
  salesTotal: number     // centavos
  profit: number         // centavos
  exempt: boolean
  taxableProfit: number  // centavos
  taxRate: number        // %
  taxDue: number         // centavos
}

export interface TaxReport {
  year: number
  rows: TaxMonthRow[]
  totalTaxDue: number
  totalProfit: number
  totalExemptProfit: number
}

// Payloads

export interface CreateInvestmentRvPayload {
  ticker: string
  name: string
  assetClass: RvAssetClass
  // operação inicial opcional
  quantity?: number
  unitPrice?: number    // centavos
  fees?: number         // centavos
  date?: string         // YYYY-MM-DD
}

export interface CreateInvestmentRfPayload {
  name: string
  assetClass: RfAssetClass
  investedAmount: number       // centavos
  applicationDate: string      // YYYY-MM-DD
  maturityDate?: string | null // YYYY-MM-DD
  rateType: RateType
  rateValue: number            // % * 100
}

export interface CreateInvestmentTransactionPayload {
  operation: 'compra' | 'venda'
  quantity: number
  unitPrice: number   // centavos
  fees?: number       // centavos
  date: string        // YYYY-MM-DD
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
  amount: number         // centavos (valor absoluto — o sinal é definido por operationType)
  categoryId: string
  dependentId?: string | null  // dependente associado à transação
  paymentMethod?: string        // 'credito' | 'pix' | 'debito' | 'dinheiro' | 'outros'
  operationType?: 'despesa' | 'reembolso'  // 'despesa' = positivo (padrão); 'reembolso' = negativo
  installmentTotal?: number                // 1 ou undefined = à vista; 2–24 = parcelado
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {
  paymentMethod?: string
  dependentId?: string | null
}

export interface SetDependentPayload {
  dependentId: string | null
  force?: boolean
}

export interface CreateCategoryPayload {
  name: string
  color?: string | null  // hex color, e.g. '#ef4444'
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
