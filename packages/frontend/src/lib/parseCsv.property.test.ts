// Feature: controle-financeiro, Property 1: parser invariante à ordem e encoding

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { parseCsvString, type ParsedTransaction } from './parseCsv'

/**
 * Validates: Requirements 1.8, 1.9
 *
 * Property 1: Parser CSV é invariante à ordem das colunas e à codificação
 *
 * Para qualquer arquivo CSV válido com colunas de data, descrição e valor em qualquer ordem,
 * encodado em UTF-8 ou UTF-8 com BOM, o resultado do parse deve produzir o mesmo conjunto
 * de transações que produziria com as colunas na ordem canônica e em UTF-8 puro.
 */

// --- Generators ---

/** Generates a valid date in YYYY-MM-DD format */
const validDateArb = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2030, 11, 31),
}).map(d => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

/** Generates a valid non-empty description without CSV-breaking characters */
const validDescriptionArb = fc.stringOf(
  fc.oneof(
    fc.char().filter(c => c !== ',' && c !== '\n' && c !== '\r' && c !== '"'),
  ),
  { minLength: 1, maxLength: 50 }
).map(s => s.trim()).filter(s => s.length > 0)

/** Generates a valid positive monetary value as string (e.g., "123.45") */
const validAmountArb = fc.integer({ min: 1, max: 9999999 }).map(centavos => {
  const reais = (centavos / 100).toFixed(2)
  return reais
})

/** A single CSV record (row data) */
interface CsvRecord {
  date: string
  description: string
  amount: string
}

/** Generates an array of valid CSV records */
const validCsvRecordsArb = fc.array(
  fc.tuple(validDateArb, validDescriptionArb, validAmountArb).map(([date, description, amount]) => ({
    date,
    description,
    amount,
  })),
  { minLength: 1, maxLength: 10 }
)

/** All possible permutations of 3 columns */
type ColumnOrder = ['date', 'description', 'value']
const allColumnOrders: ColumnOrder[] = [
  ['date', 'description', 'value'],
  ['date', 'value', 'description'],
  ['description', 'date', 'value'],
  ['description', 'value', 'date'],
  ['value', 'date', 'description'],
  ['value', 'description', 'date'],
]

/** Header name variants for each canonical column */
const headerVariants: Record<string, string[]> = {
  date: ['data', 'Data', 'DATA', 'date', 'Date'],
  description: ['descrição', 'Descrição', 'DESCRIÇÃO', 'description', 'Description'],
  value: ['valor', 'Valor', 'VALOR', 'value', 'Value'],
}

/** Generates a random column order */
const columnOrderArb = fc.constantFrom(...allColumnOrders)

/** Generates header name variants for the columns */
const headerVariantArb = fc.tuple(
  fc.constantFrom(...headerVariants.date),
  fc.constantFrom(...headerVariants.description),
  fc.constantFrom(...headerVariants.value),
)

/** Generates encoding: plain UTF-8 or UTF-8 with BOM */
const encodingArb = fc.constantFrom('utf8' as const, 'utf8bom' as const)

/**
 * Builds a CSV string from records given a column order, header names, and encoding.
 */
function buildCsv(
  records: CsvRecord[],
  order: ColumnOrder,
  headers: [string, string, string],
  encoding: 'utf8' | 'utf8bom'
): string {
  const headerMap: Record<string, string> = {
    date: headers[0],
    description: headers[1],
    value: headers[2],
  }

  const headerRow = order.map(col => headerMap[col]).join(',')
  const dataRows = records.map(record => {
    return order.map(col => {
      if (col === 'date') return record.date
      if (col === 'description') return record.description
      if (col === 'value') return record.amount
      return ''
    }).join(',')
  })

  const csv = [headerRow, ...dataRows].join('\n')

  if (encoding === 'utf8bom') {
    return '\uFEFF' + csv
  }
  return csv
}

/**
 * Compares two ParsedTransaction arrays for equality (order matters since CSV is ordered).
 */
function transactionsEqual(a: ParsedTransaction[], b: ParsedTransaction[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].date !== b[i].date) return false
    if (a[i].description !== b[i].description) return false
    if (a[i].amount !== b[i].amount) return false
  }
  return true
}

// --- Property Tests ---

describe('Property 1: Parser CSV é invariante à ordem de colunas e encoding', () => {
  it('should produce identical output regardless of column order', () => {
    fc.assert(
      fc.property(
        validCsvRecordsArb,
        columnOrderArb,
        headerVariantArb,
        (records, order, headers) => {
          // Parse with canonical order (date, description, value) in UTF-8
          const canonicalCsv = buildCsv(records, ['date', 'description', 'value'], ['data', 'descrição', 'valor'], 'utf8')
          const canonicalResult = parseCsvString(canonicalCsv)

          // Parse with the permuted order
          const permutedCsv = buildCsv(records, order, headers, 'utf8')
          const permutedResult = parseCsvString(permutedCsv)

          // Results must be identical
          expect(permutedResult.valid.length).toBe(canonicalResult.valid.length)
          expect(permutedResult.invalidCount).toBe(canonicalResult.invalidCount)
          expect(transactionsEqual(permutedResult.valid, canonicalResult.valid)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce identical output regardless of encoding (UTF-8 vs UTF-8+BOM)', () => {
    fc.assert(
      fc.property(
        validCsvRecordsArb,
        columnOrderArb,
        headerVariantArb,
        encodingArb,
        (records, order, headers, encoding) => {
          // Parse with UTF-8 (no BOM)
          const utf8Csv = buildCsv(records, order, headers, 'utf8')
          const utf8Result = parseCsvString(utf8Csv)

          // Parse with UTF-8 + BOM
          const bomCsv = buildCsv(records, order, headers, 'utf8bom')
          const bomResult = parseCsvString(bomCsv)

          // Results must be identical
          expect(bomResult.valid.length).toBe(utf8Result.valid.length)
          expect(bomResult.invalidCount).toBe(utf8Result.invalidCount)
          expect(transactionsEqual(bomResult.valid, utf8Result.valid)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce identical output for all permutations × both encodings simultaneously', () => {
    fc.assert(
      fc.property(
        validCsvRecordsArb,
        headerVariantArb,
        (records, headers) => {
          // Compute canonical result
          const canonicalCsv = buildCsv(records, ['date', 'description', 'value'], ['data', 'descrição', 'valor'], 'utf8')
          const canonicalResult = parseCsvString(canonicalCsv)

          // Test ALL permutations × both encodings
          for (const order of allColumnOrders) {
            for (const encoding of ['utf8', 'utf8bom'] as const) {
              const csv = buildCsv(records, order, headers, encoding)
              const result = parseCsvString(csv)

              expect(result.valid.length).toBe(canonicalResult.valid.length)
              expect(result.invalidCount).toBe(canonicalResult.invalidCount)
              expect(transactionsEqual(result.valid, canonicalResult.valid)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
