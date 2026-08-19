import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // centavos (integer)
}

export interface CsvParseResult {
  valid: ParsedTransaction[]
  invalidCount: number
  invalidReasons: Array<{ line: number; reason: string }>
}

/**
 * Normalizes column header names to canonical form.
 * Supports multiple bank formats:
 * - data/date → date
 * - descrição/description/estabelecimento → description
 * - valor/value → value
 * - portador → (ignored, used for dependent detection)
 */
function normalizeHeader(header: string): string | null {
  const h = header.trim().toLowerCase().normalize('NFC')
  if (h === 'data' || h === 'date') return 'date'
  if (h === 'descrição' || h === 'descricao' || h === 'description' || h === 'estabelecimento') return 'description'
  if (h === 'valor' || h === 'value') return 'value'
  if (h === 'portador') return 'portador'
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
 * Accepts: "123.45", "123,45", "1234.5", "1234,5", "1234"
 * Returns centavos or null if invalid.
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '')
  if (!trimmed) return null

  // Remove currency symbol if present
  const cleaned = trimmed.replace(/^R\$\s*/, '')

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

  // Convert to centavos (use absolute value — negative values are credits/refunds)
  return Math.round(Math.abs(num) * 100)
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
