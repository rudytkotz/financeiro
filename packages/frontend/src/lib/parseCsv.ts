import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // centavos (integer)
  portador?: string   // nome do portador (para identificar dependentes)
  installment?: string // parcela formatada ex: "4/7"
  installmentCurrent?: number // parcela atual
  installmentTotal?: number   // total de parcelas
}

export interface CsvParseResult {
  valid: ParsedTransaction[]
  invalidCount: number
  invalidReasons: Array<{ line: number; reason: string }>
}

/**
 * Normalizes column header names to canonical form.
 * Supports multiple bank formats:
 * - data/date/data de compra → date
 * - descrição/description/estabelecimento → description
 * - valor/value/valor (em r$) → value
 * - portador/nome no cartão → portador
 * - parcela/installment/parcelas → installment
 */
function normalizeHeader(header: string): string | null {
  // Normalize: remove accents, lowercase, collapse whitespace
  const h = header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/\s+/g, ' ')

  if (h === 'data' || h === 'date' || h === 'data de compra') return 'date'
  if (
    h === 'descricao' ||
    h === 'description' ||
    h === 'estabelecimento'
  )
    return 'description'
  if (h === 'valor' || h === 'value' || h === 'valor (em r$)') return 'value'
  if (h === 'portador' || h === 'nome no cartao') return 'portador'
  if (h === 'parcela' || h === 'installment' || h === 'parcelas') return 'installment'
  return null
}

/**
 * Parses a date string in YYYY-MM-DD or DD/MM/YYYY format.
 * Returns ISO date string (YYYY-MM-DD) or null if invalid.
 */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim()

  // Try YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    if (
      d.getFullYear() === Number(year) &&
      d.getMonth() === Number(month) - 1 &&
      d.getDate() === Number(day)
    ) {
      return trimmed
    }
    return null
  }

  // Try DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    if (
      d.getFullYear() === Number(year) &&
      d.getMonth() === Number(month) - 1 &&
      d.getDate() === Number(day)
    ) {
      return `${year}-${month}-${day}`
    }
    return null
  }

  return null
}

/**
 * Parses a monetary value string to centavos (integer).
 * Accepts: "123.45", "123,45", "1234.5", "1234,5", "1234", "-50,00"
 * Returns centavos (positive or negative) or null if invalid.
 * Negative values represent refunds/credits.
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (!trimmed) return null

  // Remove currency symbol if present
  const cleaned = trimmed.replace(/^R\$\s*/, '').replace(/^-\s*R\$\s*/, '-')

  // Determine decimal separator
  // If both . and , exist, the last one is the decimal separator
  let normalized: string
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma > lastDot) {
    // Comma is decimal separator (Brazilian format: 1.234,56 or 1234,56)
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (US format: 1,234.56 or 1234.56)
    normalized = cleaned.replace(/,/g, '')
  } else {
    // No decimal separator (integer)
    normalized = cleaned
  }

  const num = Number(normalized)
  if (isNaN(num) || num === 0) return null

  // Convert to centavos preserving sign (negative = refund/credit)
  return Math.round(num * 100)
}

/**
 * Removes UTF-8 BOM from string if present.
 */
function removeBom(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1)
  }
  return text
}

/**
 * Parses installment string like "4 de 7", "4/7", "04/07", "Única".
 * Returns { current, total } or null if not an installment (e.g., "-", "Única", or empty).
 * "Única" means a single one-time charge — treated as no installment.
 */
function parseInstallment(raw: string): { current: number; total: number } | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '-') return null

  // "Única" / "Unica" = à vista, sem parcela
  if (trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'unica') return null

  // Try "4 de 7" format
  const deMatch = trimmed.match(/^(\d+)\s*de\s*(\d+)$/i)
  if (deMatch) {
    return { current: parseInt(deMatch[1], 10), total: parseInt(deMatch[2], 10) }
  }

  // Try "4/7" or "04/07" format
  const slashMatch = trimmed.match(/^(\d+)\/(\d+)$/)
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10)
    const b = parseInt(slashMatch[2], 10)
    // Only treat as installment if values make sense (current <= total, total > 1)
    if (a <= b && b > 1) {
      return { current: a, total: b }
    }
  }

  return null
}

/**
 * Detects the CSV delimiter by checking the first line.
 * If semicolons are more common than commas in the header, use semicolon.
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || ''
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  return semicolons > commas ? ';' : ','
}

/**
 * Internal parse function that works on string content directly.
 * Exported for testing purposes.
 */
export function parseCsvString(content: string): CsvParseResult {
  const cleanContent = removeBom(content)
  const delimiter = detectDelimiter(cleanContent)

  const result = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header: string) => header.trim(),
  })

  // Map headers to canonical names
  const headerMap: Record<string, string> = {}
  const fields = result.meta.fields || []
  for (const field of fields) {
    const canonical = normalizeHeader(field)
    if (canonical) {
      headerMap[canonical] = field
    }
  }

  // Ensure all required columns are present
  if (!headerMap['date'] || !headerMap['description'] || !headerMap['value']) {
    return {
      valid: [],
      invalidCount: 0,
      invalidReasons: [{ line: 1, reason: 'Colunas obrigatórias ausentes (data, descrição, valor)' }],
    }
  }

  const valid: ParsedTransaction[] = []
  const invalidReasons: Array<{ line: number; reason: string }> = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]
    const lineNumber = i + 2 // +1 for 0-index, +1 for header row

    const rawDate = row[headerMap['date']] || ''
    const rawDescription = row[headerMap['description']] || ''
    const rawValue = row[headerMap['value']] || ''

    // Validate date
    const parsedDate = parseDate(rawDate)
    if (!parsedDate) {
      invalidReasons.push({ line: lineNumber, reason: `Data inválida: "${rawDate}"` })
      continue
    }

    // Validate description
    const description = rawDescription.trim()
    if (!description) {
      invalidReasons.push({ line: lineNumber, reason: 'Descrição vazia' })
      continue
    }

    // Validate amount
    const amount = parseAmount(rawValue)
    if (amount === null) {
      invalidReasons.push({ line: lineNumber, reason: `Valor inválido: "${rawValue}"` })
      continue
    }

    valid.push({
      date: parsedDate,
      description,
      amount,
      ...(headerMap['portador'] && row[headerMap['portador']]?.trim()
        ? { portador: row[headerMap['portador']].trim() }
        : {}),
      ...(headerMap['installment'] ? (() => {
        const inst = parseInstallment(row[headerMap['installment']] || '')
        if (inst) {
          return {
            installment: `${inst.current}/${inst.total}`,
            installmentCurrent: inst.current,
            installmentTotal: inst.total,
          }
        }
        return {}
      })() : {}),
    })
  }

  return {
    valid,
    invalidCount: invalidReasons.length,
    invalidReasons,
  }
}

/**
 * Parses a CSV file and extracts transactions.
 * Supports UTF-8 and UTF-8 with BOM.
 * Detects columns (data, descrição/description, valor/value) regardless of order (case-insensitive).
 */
export async function parseCsv(file: File): Promise<CsvParseResult> {
  const text = await file.text()
  return parseCsvString(text)
}
