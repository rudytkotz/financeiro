// Feature: controle-financeiro, Property 2: linhas válidas extraídas

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { parseCsvString, type ParsedTransaction } from './parseCsv'

/**
 * Validates: Requirements 1.4
 *
 * Property 2: Linhas válidas são sempre extraídas, independente das inválidas
 *
 * Para qualquer arquivo CSV contendo uma mistura arbitrária de linhas válidas e inválidas,
 * o conjunto de transações extraídas deve ser exatamente idêntico ao conjunto que seria
 * extraído se o arquivo contivesse apenas as linhas válidas — nem mais, nem menos.
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
  fc.char().filter(c => c !== ',' && c !== '\n' && c !== '\r' && c !== '"'),
  { minLength: 1, maxLength: 50 }
).map(s => s.trim()).filter(s => s.length > 0)

/** Generates a valid positive monetary value as string (e.g., "123.45") */
const validAmountStringArb = fc.integer({ min: 1, max: 9999999 }).map(centavos => {
  return (centavos / 100).toFixed(2)
})

/** Represents a valid CSV line (raw strings) */
interface ValidLine {
  kind: 'valid'
  date: string
  description: string
  amount: string
}

/** Represents an invalid CSV line (raw strings) */
interface InvalidLine {
  kind: 'invalid'
  date: string
  description: string
  amount: string
}

type CsvLine = ValidLine | InvalidLine

/** Generates a valid CSV line */
const validLineArb: fc.Arbitrary<ValidLine> = fc.tuple(
  validDateArb,
  validDescriptionArb,
  validAmountStringArb,
).map(([date, description, amount]) => ({
  kind: 'valid' as const,
  date,
  description,
  amount,
}))

/** Generates an invalid date (wrong format) */
const invalidDateArb = fc.oneof(
  // Random garbage that doesn't match YYYY-MM-DD or DD/MM/YYYY
  fc.constantFrom(
    '2024/01/15',
    '01-15-2024',
    '2024-13-01',
    '2024-02-30',
    'not-a-date',
    '20240115',
    '',
    '2024-00-01',
    '2024-01-32',
  ),
)

/** Generates an invalid amount (zero, negative, non-numeric, or empty) */
const invalidAmountArb = fc.oneof(
  fc.constant('0'),
  fc.constant('0.00'),
  fc.constant('-10.50'),
  fc.constant('-1'),
  fc.constant('abc'),
  fc.constant(''),
  fc.constant('NaN'),
  fc.constant('12.34.56'),
)

/** Generates an invalid CSV line using one of several strategies */
const invalidLineArb: fc.Arbitrary<InvalidLine> = fc.oneof(
  // Strategy 1: Invalid date
  fc.tuple(invalidDateArb, validDescriptionArb, validAmountStringArb).map(
    ([date, description, amount]) => ({
      kind: 'invalid' as const,
      date,
      description,
      amount,
    })
  ),
  // Strategy 2: Empty description
  fc.tuple(validDateArb, fc.constant(''), validAmountStringArb).map(
    ([date, description, amount]) => ({
      kind: 'invalid' as const,
      date,
      description,
      amount,
    })
  ),
  // Strategy 3: Description with only whitespace
  fc.tuple(validDateArb, fc.constantFrom('   ', '\t', '  \t  '), validAmountStringArb).map(
    ([date, description, amount]) => ({
      kind: 'invalid' as const,
      date,
      description,
      amount,
    })
  ),
  // Strategy 4: Invalid amount (zero, negative, non-numeric)
  fc.tuple(validDateArb, validDescriptionArb, invalidAmountArb).map(
    ([date, description, amount]) => ({
      kind: 'invalid' as const,
      date,
      description,
      amount,
    })
  ),
)

/** Generates a mixed array of valid and invalid lines (at least 1 valid) */
const mixedLinesArb = fc.tuple(
  fc.array(validLineArb, { minLength: 1, maxLength: 8 }),
  fc.array(invalidLineArb, { minLength: 1, maxLength: 8 }),
).chain(([validLines, invalidLines]) => {
  const allLines: CsvLine[] = [...validLines, ...invalidLines]
  // Shuffle the lines randomly
  return fc.shuffledSubarray(allLines, { minLength: allLines.length, maxLength: allLines.length })
})

/**
 * Builds a CSV string from an array of lines with the canonical header.
 */
function buildCsvFromLines(lines: CsvLine[]): string {
  const header = 'data,descrição,valor'
  const rows = lines.map(line => `${line.date},${line.description},${line.amount}`)
  return [header, ...rows].join('\n')
}

/**
 * Compares two ParsedTransaction arrays for equality (order-preserving).
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

describe('Property 2: Linhas válidas extraídas independente das inválidas', () => {
  it('should extract exactly the valid lines regardless of invalid lines presence', () => {
    fc.assert(
      fc.property(
        mixedLinesArb,
        (lines) => {
          // Build CSV with all lines (valid + invalid mixed)
          const mixedCsv = buildCsvFromLines(lines)
          const mixedResult = parseCsvString(mixedCsv)

          // Build CSV with only the valid lines (same order)
          const validOnlyLines = lines.filter((l): l is ValidLine => l.kind === 'valid')
          const validOnlyCsv = buildCsvFromLines(validOnlyLines)
          const validOnlyResult = parseCsvString(validOnlyCsv)

          // The valid transactions extracted from both must be identical
          expect(mixedResult.valid.length).toBe(validOnlyResult.valid.length)
          expect(transactionsEqual(mixedResult.valid, validOnlyResult.valid)).toBe(true)

          // The valid count must equal the number of valid lines
          expect(mixedResult.valid.length).toBe(validOnlyLines.length)

          // Invalid count in the mixed result must match the number of invalid lines
          const invalidCount = lines.filter(l => l.kind === 'invalid').length
          expect(mixedResult.invalidCount).toBe(invalidCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve the order of valid lines regardless of invalid lines interspersed', () => {
    fc.assert(
      fc.property(
        mixedLinesArb,
        (lines) => {
          const mixedCsv = buildCsvFromLines(lines)
          const mixedResult = parseCsvString(mixedCsv)

          // Extract valid lines in their original order from the mixed input
          const validLinesInOrder = lines.filter((l): l is ValidLine => l.kind === 'valid')

          // Verify each extracted transaction matches the corresponding valid line
          for (let i = 0; i < mixedResult.valid.length; i++) {
            const tx = mixedResult.valid[i]
            const expected = validLinesInOrder[i]
            expect(tx.date).toBe(expected.date)
            expect(tx.description).toBe(expected.description)
            // Amount should be the centavos value of the expected amount string
            expect(tx.amount).toBe(Math.round(parseFloat(expected.amount) * 100))
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
