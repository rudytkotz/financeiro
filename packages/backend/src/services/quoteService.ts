/**
 * Quote service — busca cotações de ativos da B3.
 *
 * Fonte principal: Yahoo Finance (gratuito, sem token).
 *   Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}.SA
 *   Tickers da B3 usam o sufixo .SA (ex: PETR4.SA, HGLG11.SA).
 *
 * Fallback: brapi.dev (se BRAPI_TOKEN estiver configurado).
 *   Usado apenas se o Yahoo falhar.
 *
 * Inclui cache em memória (TTL) para reduzir chamadas externas.
 */

export interface Quote {
  ticker: string         // ticker original da B3 (sem .SA)
  price: number          // reais (float)
  change: number         // variação % do dia
  previousClose: number
  name: string | null
  updatedAt: string | null
}

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const BRAPI_BASE = 'https://brapi.dev/api/quote'

interface CacheEntry {
  quote: Quote
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

/**
 * Busca a cotação de um ticker no Yahoo Finance.
 * Retorna null se falhar.
 */
async function fetchFromYahoo(ticker: string): Promise<Quote | null> {
  try {
    const url = `${YAHOO_BASE}/${ticker}.SA?interval=1d&range=1d`
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Yahoo bloqueia requests sem user-agent de navegador
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceiroApp/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) return null

    const data = await resp.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number
            chartPreviousClose?: number
            previousClose?: number
            longName?: string
            shortName?: string
            regularMarketTime?: number
          }
        }>
        error?: unknown
      }
    }

    const meta = data.chart?.result?.[0]?.meta
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null

    const price = meta.regularMarketPrice
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price
    const change = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0

    return {
      ticker,
      price,
      change: Math.round(change * 100) / 100,
      previousClose,
      name: meta.longName ?? meta.shortName ?? null,
      updatedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    }
  } catch {
    return null
  }
}

/**
 * Fallback: busca cotações no brapi.dev (requer BRAPI_TOKEN).
 * Aceita múltiplos tickers numa chamada.
 */
async function fetchFromBrapi(tickers: string[]): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>()
  const token = process.env.BRAPI_TOKEN
  if (!token || tickers.length === 0) return result

  try {
    const url = `${BRAPI_BASE}/${tickers.join(',')}?token=${token}`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return result

    const data = await resp.json() as {
      results?: Array<{
        symbol: string
        regularMarketPrice?: number
        regularMarketChangePercent?: number
        regularMarketPreviousClose?: number
        longName?: string
        shortName?: string
        regularMarketTime?: string
      }>
    }

    for (const r of data.results ?? []) {
      if (typeof r.regularMarketPrice !== 'number') continue
      result.set(r.symbol, {
        ticker: r.symbol,
        price: r.regularMarketPrice,
        change: r.regularMarketChangePercent ?? 0,
        previousClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
        name: r.longName ?? r.shortName ?? null,
        updatedAt: r.regularMarketTime ?? null,
      })
    }
  } catch {
    // ignora — já retorna o que tiver
  }

  return result
}

/**
 * Busca cotações de uma lista de tickers. Usa cache quando disponível.
 * Estratégia: tenta Yahoo (por ticker, em paralelo); os que falharem
 * caem no fallback brapi (em batch).
 * Retorna um Map ticker → Quote. Tickers que falharem em ambos são omitidos.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>()
  if (tickers.length === 0) return result

  const uniqueTickers = [...new Set(tickers.map(normalizeTicker).filter(Boolean))]
  const now = Date.now()
  const toFetch: string[] = []

  // 1. Resolver do cache
  for (const ticker of uniqueTickers) {
    const cached = cache.get(ticker)
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result.set(ticker, cached.quote)
    } else {
      toFetch.push(ticker)
    }
  }

  if (toFetch.length === 0) return result

  // 2. Tentar Yahoo em paralelo (cada ticker é uma chamada)
  const yahooResults = await Promise.all(
    toFetch.map(async (ticker) => ({ ticker, quote: await fetchFromYahoo(ticker) }))
  )

  const failedYahoo: string[] = []
  for (const { ticker, quote } of yahooResults) {
    if (quote) {
      cache.set(ticker, { quote, fetchedAt: now })
      result.set(ticker, quote)
    } else {
      failedYahoo.push(ticker)
    }
  }

  // 3. Fallback brapi para os que o Yahoo não resolveu
  if (failedYahoo.length > 0) {
    const brapiResults = await fetchFromBrapi(failedYahoo)
    for (const [ticker, quote] of brapiResults) {
      cache.set(ticker, { quote, fetchedAt: now })
      result.set(ticker, quote)
    }
  }

  return result
}

/**
 * Busca a cotação de um único ticker.
 */
export async function getQuote(ticker: string): Promise<Quote | null> {
  const quotes = await getQuotes([ticker])
  return quotes.get(normalizeTicker(ticker)) ?? null
}
