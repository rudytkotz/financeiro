import { describe, it, expect } from 'vitest'
import { computePosition } from './investmentService.js'
import type { InvestmentTransaction } from '../db/schema.js'

/**
 * Helper para montar uma operação mínima de investimento.
 * Valores monetários em centavos.
 */
function tx(
  operation: 'compra' | 'venda',
  quantity: number,
  unitPrice: number,
  date: string,
  fees = 0,
): InvestmentTransaction {
  return {
    id: `${operation}-${date}-${quantity}`,
    investmentId: 'inv-1',
    operation,
    quantity,
    unitPrice,
    fees,
    date,
    userId: 'user-1',
    createdAt: new Date(),
  } as InvestmentTransaction
}

describe('computePosition — preço médio', () => {
  it('posição vazia sem operações', () => {
    const r = computePosition([])
    expect(r).toEqual({ quantity: 0, averagePrice: 0, investedTotal: 0 })
  })

  it('uma única compra define quantidade e preço médio', () => {
    // 10 cotas a R$ 20,00 (2000 centavos) = R$ 200,00 investido
    const r = computePosition([tx('compra', 10, 2000, '2024-01-01')])
    expect(r.quantity).toBe(10)
    expect(r.averagePrice).toBe(2000)
    expect(r.investedTotal).toBe(20000)
  })

  it('inclui taxas no custo e no preço médio', () => {
    // 10 cotas a 2000 + 500 de taxa = 20500 de custo → PM 2050
    const r = computePosition([tx('compra', 10, 2000, '2024-01-01', 500)])
    expect(r.quantity).toBe(10)
    expect(r.investedTotal).toBe(20500)
    expect(r.averagePrice).toBe(2050)
  })

  it('duas compras calculam preço médio ponderado', () => {
    // 10 @ 2000 (20000) + 10 @ 3000 (30000) = 50000 / 20 = 2500
    const r = computePosition([
      tx('compra', 10, 2000, '2024-01-01'),
      tx('compra', 10, 3000, '2024-02-01'),
    ])
    expect(r.quantity).toBe(20)
    expect(r.averagePrice).toBe(2500)
    expect(r.investedTotal).toBe(50000)
  })

  it('venda reduz a quantidade mantendo o preço médio', () => {
    // compra 20 @ 2500; vende 5 → sobra 15 ao mesmo PM 2500
    const r = computePosition([
      tx('compra', 20, 2500, '2024-01-01'),
      tx('venda', 5, 3000, '2024-03-01'),
    ])
    expect(r.quantity).toBe(15)
    expect(r.averagePrice).toBe(2500)
    expect(r.investedTotal).toBe(37500)
  })

  it('vender tudo zera a posição', () => {
    const r = computePosition([
      tx('compra', 10, 2000, '2024-01-01'),
      tx('venda', 10, 3000, '2024-03-01'),
    ])
    expect(r).toEqual({ quantity: 0, averagePrice: 0, investedTotal: 0 })
  })

  it('processa as operações em ordem cronológica independente da ordem do array', () => {
    const r = computePosition([
      tx('venda', 5, 3000, '2024-03-01'),
      tx('compra', 10, 2000, '2024-01-01'),
      tx('compra', 10, 3000, '2024-02-01'),
    ])
    // Ordenado: compra 10@2000, compra 10@3000 (PM 2500), venda 5 → sobra 15 @ 2500
    expect(r.quantity).toBe(15)
    expect(r.averagePrice).toBe(2500)
  })

  it('venda maior que a quantidade disponível zera sem ficar negativo', () => {
    const r = computePosition([
      tx('compra', 5, 2000, '2024-01-01'),
      tx('venda', 10, 2500, '2024-02-01'),
    ])
    expect(r.quantity).toBe(0)
    expect(r.averagePrice).toBe(0)
    expect(r.investedTotal).toBe(0)
  })
})
