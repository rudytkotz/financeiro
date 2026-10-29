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
  accountId: string | null
  transferId: string | null
  tags: string | null              // tags separadas por vírgula
  attachmentUrl: string | null     // comprovante (data URL ou link)
  attachmentName: string | null
  deletedAt: string | null         // soft delete (lixeira)
  kind: 'despesa' | 'receita' | 'transfer'
  recurringId: string | null
  createdAt: string
  updatedAt: string
}

// Transações recorrentes / contas a pagar e receber
export interface RecurringTransaction {
  id: string
  description: string
  amount: number           // centavos
  kind: 'despesa' | 'receita'
  categoryId: string | null
  accountId: string | null
  dependentId: string | null
  paymentMethod: string
  dayOfMonth: number       // 1-31
  startMonth: string       // YYYY-MM
  endMonth: string | null  // YYYY-MM
  active: boolean
  createdAt: string
}

export interface CreateRecurringPayload {
  description: string
  amount: number
  kind?: 'despesa' | 'receita'
  categoryId?: string | null
  accountId?: string | null
  dependentId?: string | null
  paymentMethod?: string
  dayOfMonth: number
  startMonth: string
  endMonth?: string | null
}

// Metas financeiras
export interface Goal {
  id: string
  name: string
  targetAmount: number     // centavos
  currentAmount: number    // centavos (manual; ignorado quando há conta vinculada)
  targetDate: string | null
  color: string | null
  accountId: string | null // conta vinculada (progresso puxa o saldo real)
  archived: boolean
  createdAt: string
  percentage: number       // currentAmount / targetAmount * 100
  remaining: number        // centavos
}

export interface GoalContribution {
  id: string
  goalId: string
  amount: number           // centavos (positivo=aporte, negativo=retirada)
  date: string
  note: string | null
  createdAt: string
}

export interface CreateGoalPayload {
  name: string
  targetAmount: number
  targetDate?: string | null
  color?: string | null
  accountId?: string | null
}

export interface AddContributionPayload {
  amount: number
  date: string
  note?: string | null
}

// Projeção / saúde financeira
export interface MonthProjection {
  month: string
  projectedIncome: number
  projectedExpenses: number
  projectedBalance: number
  accumulated: number
}

export interface FinancialHealth {
  avgMonthlyIncome: number
  avgMonthlyExpenses: number
  avgMonthlyBalance: number
  currentMonthIncome: number
  currentMonthExpenses: number
  savingsRate: number
  totalGoalsTarget: number
  totalGoalsSaved: number
  projection: MonthProjection[]
  monthsAnalyzed: number
}

// Alertas
export interface Alert {
  kind: 'budget' | 'bill' | 'goal'
  severity: 'info' | 'warning' | 'danger'
  message: string
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
  accountId: string | null // conta onde a renda entra (nullable)
}

// Contas / carteiras
export type AccountType = 'corrente' | 'poupanca' | 'carteira' | 'cartao' | 'investimento' | 'outro'

export interface Account {
  id: string
  name: string
  type: AccountType
  initialBalance: number       // centavos
  color: string | null
  closingDay: number | null    // dia de fechamento da fatura (cartão)
  dueDay: number | null        // dia de vencimento da fatura (cartão)
  creditLimit: number | null   // centavos (cartão)
  parentAccountId: string | null // conta pai (cartão → conta corrente)
  dependentId: string | null     // dependente dono da conta
  archived: boolean
  createdAt: string
  currentBalance: number       // centavos (calculado no backend)
}

export interface CreateAccountPayload {
  name: string
  type?: AccountType
  initialBalance?: number
  color?: string | null
  closingDay?: number | null
  dueDay?: number | null
  creditLimit?: number | null
  parentAccountId?: string | null
  dependentId?: string | null
}

// Resumo agregado por conta (saldo + investido + atividade)
export interface AccountSummary {
  accountId: string
  currentBalance: number
  investedCurrent: number
  investmentCount: number
  transactionCount: number
  linkedCardCount: number
}

// Fatura de cartão de crédito
export interface InvoiceSummary {
  accountId: string
  accountName: string
  referenceMonth: string
  closingDate: string
  dueDate: string
  previousClosingDate: string
  total: number              // centavos
  creditLimit: number | null
  limitUsagePct: number | null
  transactions: Transaction[]
}

export interface Import {
  id: string
  referenceMonth: string // YYYY-MM
  importedAt: string
  transactionCount: number
}

// Investimentos

export type InvestmentType = 'renda_variavel' | 'renda_fixa'
export type RvAssetClass = 'acao' | 'fii' | 'etf' | 'bdr' | 'cripto' | 'moeda'
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
  accountId: string | null         // conta/corretora onde o ativo está (nullable)
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

// Projeção de proventos futuros
export interface DividendForecastItem {
  investmentId: string
  ticker: string | null
  name: string
  quantity: number
  perShareLast12m: number     // reais por cota (soma 12m)
  projectedAnnual: number     // centavos
  projectedMonthly: number    // centavos
  projectedYieldOnCost: number // %
}

export interface DividendForecast {
  items: DividendForecastItem[]
  totalProjectedAnnual: number
  totalProjectedMonthly: number
  projectedYieldOnCost: number
  calendar: Array<{ monthLabel: string; amount: number }>
  hasData: boolean
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
  accountId?: string | null
}

export interface CreateInvestmentRfPayload {
  name: string
  assetClass: RfAssetClass
  investedAmount: number       // centavos
  applicationDate: string      // YYYY-MM-DD
  maturityDate?: string | null // YYYY-MM-DD
  rateType: RateType
  rateValue: number            // % * 100
  accountId?: string | null
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
  transactionIncome: number
  totalIncome: number
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
  accountId?: string | null     // conta/carteira associada
  paymentMethod?: string        // 'credito' | 'pix' | 'debito' | 'dinheiro' | 'outros'
  operationType?: 'despesa' | 'reembolso'  // 'despesa' = positivo (padrão); 'reembolso' = negativo
  kind?: 'despesa' | 'receita'             // receita = entrada de dinheiro
  installmentTotal?: number                // 1 ou undefined = à vista; 2–24 = parcelado
  tags?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {
  paymentMethod?: string
  dependentId?: string | null
  tags?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
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
  accountId?: string | null
}

// Orçamento por categoria
export interface BudgetRow {
  id: string | null
  categoryId: string
  categoryName: string
  categoryColor: string | null
  amount: number         // teto planejado (centavos)
  spent: number          // gasto realizado (centavos)
  remaining: number      // amount - spent
  percentage: number     // spent / amount * 100
}

export interface BudgetSummary {
  month: string
  totalBudget: number
  totalSpent: number
  rows: BudgetRow[]
}

export interface SetBudgetPayload {
  categoryId: string
  month: string
  amount: number         // centavos (0 remove o orçamento)
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

// ---------------------------------------------------------------------------
// Novas análises e ferramentas
// ---------------------------------------------------------------------------

// Comparativo mensal (este mês vs anterior vs média)
export interface MonthComparisonCategory {
  categoryId: string | null
  categoryName: string
  current: number       // centavos
  previous: number      // centavos
  average: number       // centavos (média dos meses anteriores analisados)
  changePct: number | null // variação % vs mês anterior (null se anterior = 0)
}

export interface MonthComparison {
  month: string
  previousMonth: string
  monthsAnalyzed: number
  currentTotal: number
  previousTotal: number
  averageTotal: number
  changePct: number | null
  categories: MonthComparisonCategory[]
}

// Fluxo de caixa projetado do mês (o que ainda vai entrar/sair)
export interface CashFlowItem {
  description: string
  amount: number        // centavos (positivo = saída, negativo = entrada)
  date: string          // YYYY-MM-DD previsto
  kind: 'recorrente' | 'parcela' | 'renda'
}

export interface CashFlowForecast {
  month: string
  currentBalance: number     // saldo somado das contas hoje
  realizedExpenses: number   // já gasto no mês
  realizedIncome: number     // já recebido no mês
  pendingItems: CashFlowItem[]
  projectedExpenses: number  // pendentes de saída
  projectedIncome: number    // pendentes de entrada
  projectedEndBalance: number
}

// Evolução patrimonial consolidada (contas + investimentos) mês a mês
export interface NetWorthPoint {
  month: string
  accounts: number       // saldo em contas (centavos)
  investments: number    // valor investido (centavos)
  total: number
  investmentsEstimated: boolean // true = sem snapshot real (aproximação)
}

// Retrospectiva anual
export interface YearlyReport {
  year: number
  totalIncome: number
  totalExpenses: number
  balance: number
  savingsRate: number
  topCategories: Array<{ categoryName: string; amount: number }>
  byMonth: Array<{ month: string; income: number; expenses: number; balance: number }>
  mostExpensiveMonth: { month: string; amount: number } | null
}

// Busca global de transações (atravessa meses)
export interface TransactionSearchResult {
  transactions: Transaction[]
  total: number       // soma dos amounts encontrados
  count: number
}

// Calculadora de juros compostos / simulação de aportes e dividendos
export interface CompoundSimInput {
  initialAmount: number     // aporte inicial (centavos)
  monthlyContribution: number // aporte mensal (centavos)
  months: number            // período em meses
  annualReturnPct: number   // rentabilidade anual esperada (%)
  annualDividendYieldPct: number // DY anual (%) para projeção de proventos
}

export interface CompoundSimPoint {
  month: number
  invested: number          // total aportado acumulado (centavos)
  balance: number           // patrimônio acumulado (centavos)
  dividends: number         // proventos no mês (centavos)
  accumulatedDividends: number // proventos acumulados (centavos)
}

export interface CompoundSimResult {
  points: CompoundSimPoint[]
  finalBalance: number
  totalInvested: number
  totalReturn: number
  totalDividends: number
  monthlyDividendAtEnd: number
}
