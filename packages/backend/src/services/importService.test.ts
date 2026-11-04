import { describe, it, expect } from 'vitest'
import { calculateReferenceMonth, filterExistingTransactions } from './importService.js'

describe('ImportService — calculateReferenceMonth', () => {
  it('retorna o mês da data mais antiga para uma única transação', () => {
    const result = calculateReferenceMonth([{ date: '2024-03-15' }])
    expect(result).toBe('2024-03')
  })

  it('retorna o mês da data mais antiga para múltiplas transações', () => {
    const result = calculateReferenceMonth([
      { date: '2024-05-20' },
      { date: '2024-03-10' },
      { date: '2024-04-01' },
    ])
    expect(result).toBe('2024-03')
  })

  it('retorna corretamente quando todas as datas estão no mesmo mês', () => {
    const result = calculateReferenceMonth([
      { date: '2024-07-01' },
      { date: '2024-07-15' },
      { date: '2024-07-31' },
    ])
    expect(result).toBe('2024-07')
  })

  it('lança erro quando o array de transações está vazio', () => {
    expect(() => calculateReferenceMonth([])).toThrow(
      'Nenhuma transação fornecida para calcular o mês de referência.'
    )
  })

  it('funciona com datas em meses e anos diferentes', () => {
    const result = calculateReferenceMonth([
      { date: '2025-01-15' },
      { date: '2024-12-01' },
      { date: '2025-02-28' },
    ])
    expect(result).toBe('2024-12')
  })

  it('a comparação lexicográfica funciona para datas ISO', () => {
    const result = calculateReferenceMonth([
      { date: '2024-11-30' },
      { date: '2024-01-01' },
    ])
    expect(result).toBe('2024-01')
  })
})

describe('ImportService — filterExistingTransactions', () => {
  it('mantém somente transações ainda não importadas para o mesmo mês', async () => {
    const existing = [
      { date: '2026-11-01', description: 'Mercado', amount: 5000 },
      { date: '2026-11-03', description: 'Uber', amount: 4000 },
    ]

    const incoming = [
      { date: '2026-11-01', description: 'Mercado', amount: 5000 },
      { date: '2026-11-02', description: 'Farmacia', amount: 2500 },
      { date: '2026-11-03', description: 'Uber', amount: 4000 },
      { date: '2026-11-04', description: 'Lanche', amount: 1500 },
    ]

    const result = await filterExistingTransactions(incoming, '2026-11', 'user-1', existing)

    expect(result).toEqual([
      { date: '2026-11-02', description: 'Farmacia', amount: 2500 },
      { date: '2026-11-04', description: 'Lanche', amount: 1500 },
    ])
  })
})
