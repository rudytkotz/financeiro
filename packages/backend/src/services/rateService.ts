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
