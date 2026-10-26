/**
 * Rate service — busca taxas de referência (CDI/Selic) da API do Banco Central.
 *
 * API SGS (Sistema Gerenciador de Séries Temporais) — gratuita, sem token:
 *   https://api.bcb.gov.br/dados/serie/bcdata.sgs.{CODIGO}/dados
 *
 * Séries usadas:
 *   - 4389: CDI anualizado (% a.a.)
 *   - 12:   CDI diário (% ao dia) — usado para acumular rentabilidade em período
 *   - 11:   Selic diária
 */

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas (CDI muda no máximo 1x/dia)

interface CachedValue<T> {
  value: T
  fetchedAt: number
}

let cdiAnnualCache: CachedValue<number> | null = null
const cdiAccumCache = new Map<string, CachedValue<number>>()

interface SgsPoint {
  data: string  // DD/MM/YYYY
  valor: string
}

/**
 * Retorna o CDI anualizado atual (% a.a.). Ex: 13.65
 * Fallback para 13.65 se a API falhar.
 */
export async function getCurrentCdiAnnual(): Promise<number> {
  const now = Date.now()
  if (cdiAnnualCache && now - cdiAnnualCache.fetchedAt < CACHE_TTL_MS) {
    return cdiAnnualCache.value
  }

  try {
    const resp = await fetch(`${BCB_BASE}/bcdata.sgs.4389/dados/ultimos/1?formato=json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json() as SgsPoint[]
      const value = parseFloat(data[0]?.valor ?? '')
      if (!isNaN(value)) {
        cdiAnnualCache = { value, fetchedAt: now }
        return value
      }
    }
  } catch {
    // ignora, usa fallback
  }

  return cdiAnnualCache?.value ?? 13.65
}

function toIsoBr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/**
 * Retorna o fator acumulado do CDI entre duas datas (ex: 1.0523 = +5.23%).
 * Usa a série 12 (CDI diário) e compõe os fatores.
 * Se a API falhar, estima linearmente a partir do CDI anual.
 */
export async function getCdiAccumulatedFactor(startDate: string, endDate: string): Promise<number> {
  const cacheKey = `${startDate}_${endDate}`
  const now = Date.now()
  const cached = cdiAccumCache.get(cacheKey)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value
  }

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return 1

  try {
    const url = `${BCB_BASE}/bcdata.sgs.12/dados?formato=json&dataInicial=${toIsoBr(start)}&dataFinal=${toIsoBr(end)}`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (resp.ok) {
      const data = await resp.json() as SgsPoint[]
      let factor = 1
      for (const point of data) {
        const dailyPct = parseFloat(point.valor)
        if (!isNaN(dailyPct)) factor *= (1 + dailyPct / 100)
      }
      cdiAccumCache.set(cacheKey, { value: factor, fetchedAt: now })
      return factor
    }
  } catch {
    // ignora, usa estimativa
  }

  // Estimativa linear a partir do CDI anual
  const annual = await getCurrentCdiAnnual()
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  const businessDays = days * (252 / 365) // aproximação de dias úteis
  const estimate = Math.pow(1 + annual / 100, businessDays / 252)
  return estimate
}

// ---------------------------------------------------------------------------
// IPCA (série 433 — IPCA mensal %)
// ---------------------------------------------------------------------------
let ipcaAnnualCache: CachedValue<number> | null = null

/**
 * Retorna o IPCA acumulado dos últimos 12 meses (% a.a.).
 * Fallback para 4.5 se a API falhar.
 */
export async function getIpcaAccumulated12m(): Promise<number> {
  const now = Date.now()
  if (ipcaAnnualCache && now - ipcaAnnualCache.fetchedAt < CACHE_TTL_MS) {
    return ipcaAnnualCache.value
  }

  try {
    const resp = await fetch(`${BCB_BASE}/bcdata.sgs.433/dados/ultimos/12?formato=json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json() as SgsPoint[]
      // Compor os 12 meses: produto dos (1 + ipca_mensal/100) - 1
      let factor = 1
      for (const p of data) {
        const monthly = parseFloat(p.valor)
        if (!isNaN(monthly)) factor *= (1 + monthly / 100)
      }
      const annual = (factor - 1) * 100
      if (annual > 0) {
        ipcaAnnualCache = { value: annual, fetchedAt: now }
        return annual
      }
    }
  } catch {
    // ignora
  }

  return ipcaAnnualCache?.value ?? 4.5
}

/**
 * Retorna uma série mensal do fator CDI acumulado desde startDate até hoje.
 * Útil para o gráfico de comparação patrimônio vs CDI.
 * Retorna array de { month: 'YYYY-MM', factor: number } onde factor é acumulado
 * desde o início.
 */
export async function getCdiMonthlySeries(startDate: string): Promise<Array<{ month: string; factor: number }>> {
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date()
  if (isNaN(start.getTime()) || start >= today) return []

  const result: Array<{ month: string; factor: number }> = []

  // Gerar lista de fins de mês entre start e hoje
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const monthEnds: Date[] = []
  while (cursor <= today) {
    // Último dia do mês ou hoje, o que vier primeiro
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    monthEnds.push(monthEnd < today ? monthEnd : new Date(today))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  // Para cada fim de mês, acumular CDI desde o início
  for (const monthEnd of monthEnds) {
    const iso = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`
    const factor = await getCdiAccumulatedFactor(startDate, iso)
    result.push({
      month: iso.substring(0, 7),
      factor,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// IBOVESPA — série histórica mensal via Yahoo Finance (^BVSP)
// ---------------------------------------------------------------------------

interface IbovCache {
  startDate: string
  series: Map<string, number> // 'YYYY-MM' -> fechamento do mês
  fetchedAt: number
}
let ibovCache: IbovCache | null = null

/**
 * Retorna um Map 'YYYY-MM' -> valor de fechamento do IBOV naquele mês,
 * desde startDate. Usado para calcular o fator de valorização do índice.
 * Fonte: Yahoo Finance (^BVSP), dados mensais.
 */
async function getIbovMonthlyCloses(startDate: string): Promise<Map<string, number>> {
  const now = Date.now()
  if (ibovCache && ibovCache.startDate === startDate && now - ibovCache.fetchedAt < CACHE_TTL_MS) {
    return ibovCache.series
  }

  const series = new Map<string, number>()
  try {
    const period1 = Math.floor(new Date(startDate + 'T00:00:00').getTime() / 1000)
    const period2 = Math.floor(Date.now() / 1000)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${period2}&interval=1mo`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; FinanceiroApp/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (resp.ok) {
      const data = await resp.json() as {
        chart?: { result?: Array<{
          timestamp?: number[]
          indicators?: { quote?: Array<{ close?: (number | null)[] }> }
        }> }
      }
      const result = data.chart?.result?.[0]
      const timestamps = result?.timestamp ?? []
      const closes = result?.indicators?.quote?.[0]?.close ?? []
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i]
        if (typeof close === 'number') {
          const d = new Date(timestamps[i] * 1000)
          const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          series.set(month, close)
        }
      }
      ibovCache = { startDate, series, fetchedAt: now }
    }
  } catch {
    // ignora — retorna vazio, o gráfico simplesmente não mostra a linha do IBOV
  }

  return series
}

/**
 * Retorna uma série mensal do FATOR de valorização do IBOV acumulado desde
 * startDate. Ex: { month: '2025-03', factor: 1.08 } = +8% desde o início.
 */
export async function getIbovMonthlySeries(startDate: string): Promise<Array<{ month: string; factor: number }>> {
  const closes = await getIbovMonthlyCloses(startDate)
  if (closes.size === 0) return []

  const months = [...closes.keys()].sort()
  const baseMonth = months[0]
  const baseClose = closes.get(baseMonth)
  if (!baseClose || baseClose <= 0) return []

  return months.map((month) => ({
    month,
    factor: (closes.get(month) ?? baseClose) / baseClose,
  }))
}
