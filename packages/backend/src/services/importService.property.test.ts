// Feature: controle-financeiro, Property 3: mês de referência = data mais antiga
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateReferenceMonth } from './importService.js'

/**
 * Property 3: O mês de referência da fatura é sempre o da data mais antiga
 *
 * Para qualquer conjunto não-vazio de transações, o mês de referência
 * determinado pelo sistema deve ser igual ao mês e ano da transação
 * com a data mais antiga do arquivo.
 *
 * **Validates: Requirements 1.2**
 */
describe('Property 3: mês de referência = data mais antiga', () => {
  // Arbitrary que gera datas no formato YYYY-MM-DD
  const dateArb = fc
    .record({
      year: fc.integer({ min: 2000, max: 2099 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }), // 28 para evitar dias inválidos
    })
    .map(({ year, month, day }) => {
      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      return `${year}-${mm}-${dd}`
    })

  // Arbitrary que gera arrays não-vazios de objetos { date: string }
  const transactionsArb = fc
    .array(dateArb, { minLength: 1, maxLength: 50 })
    .map((dates) => dates.map((date) => ({ date })))

  it('deve retornar YYYY-MM da data mais antiga para qualquer conjunto de transações', () => {
    fc.assert(
      fc.property(transactionsArb, (transactions) => {
        const result = calculateReferenceMonth(transactions)

        // Calcular a data mais antiga manualmente
        const dates = transactions.map((t) => t.date)
        const oldest = dates.reduce((min, d) => (d < min ? d : min), dates[0])
        const expectedMonth = oldest.substring(0, 7)

        expect(result).toBe(expectedMonth)
      }),
      { numRuns: 100 }
    )
  })
})
