/**
 * Quote service — busca cotações de ativos da B3 via brapi.dev.
 *
 * Doc: https://brapi.dev/docs/acoes
 * Endpoint: GET https://brapi.dev/api/quote/{TICKERS}?token=XXX
 *
 * Inclui cache em memória (TTL) para respeitar o rate limit do free tier.
 */

export interface Quote {
  ticker: string
  price: number          // reais (float)
  change: number         // variação % do dia
  previousClose: number
  name: string | null
  updatedAt: string | null
}

const BRAPI_BASE = 'https://brapi.dev/api/quote'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos (free tier é EOD/atrasado mesmo)

interface CacheEntry {
  quote: Quote
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

function getToken(): string | undefined {
  return process.env.BRAPI_TOKEN
}

/**
 * Busca cotações de uma lista de tickers. Usa cache quando disponível.
 * Retorna um Map ticker → Quote. Tickers que falharem são omitidos.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>()
  if (tickers.length === 0) return result

  const uniqueTickers = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))]

  // Separar os que estão em cache válido dos que precisam buscar
  const now = Date.now()
  const toFetch: string[] = []

  for (const ticker of uniqueTickers) {
    const cached = cache.get(ticker)
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result.set(ticker, cached.quote)
    } else {
      toFetch.push(ticker)
    }
  }

  if (toFetch.length === 0) return result

  const token = getToken()

  try {
    // brapi aceita múltiplos tickers separados por vírgula
    const url = `${BRAPI_BASE}/${toFetch.join(',')}${token ? `?token=${token}` : ''}`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      // 401/429/etc — retorna o que tiver em cache, sem quebrar a feature
      console.error(`[quoteService] brapi retornou status ${resp.status}`)
      return result
    }

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
      const quote: Quote = {
        ticker: r.symbol,
        price: r.regularMarketPrice,
        change: r.regularMarketChangePercent ?? 0,
        previousClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
        name: r.longName ?? r.shortName ?? null,
        updatedAt: r.regularMarketTime ?? null,
      }
      cache.set(r.symbol, { quote, fetchedAt: now })
      result.set(r.symbol, quote)
    }
  } catch (err) {
    console.error('[quoteService] erro ao buscar cotações:', err)
    // Retorna o que tiver (cache parcial) sem quebrar
  }

  return result
}

/**
 * Busca a cotação de um único ticker.
 */
export async function getQuote(ticker: string): Promise<Quote | null> {
  const quotes = await getQuotes([ticker])
  return quotes.get(ticker.trim().toUpperCase()) ?? null
}
