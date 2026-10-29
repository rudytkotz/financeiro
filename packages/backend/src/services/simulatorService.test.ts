import { describe, it, expect } from 'vitest'
import { simulateCompound } from './simulatorService.js'

describe('simulateCompound', () => {
  it('sem rentabilidade e sem aporte, mantém o valor inicial', () => {
    const r = simulateCompound({
      initialAmount: 100_00,
      monthlyContribution: 0,
      months: 12,
      annualReturnPct: 0,
      annualDividendYieldPct: 0,
    })
    expect(r.finalBalance).toBe(100_00)
    expect(r.totalInvested).toBe(100_00)
    expect(r.totalReturn).toBe(0)
    expect(r.totalDividends).toBe(0)
  })

  it('aportes mensais somam ao total investido', () => {
    const r = simulateCompound({
      initialAmount: 0,
      monthlyContribution: 100_00,
      months: 10,
      annualReturnPct: 0,
      annualDividendYieldPct: 0,
    })
    expect(r.totalInvested).toBe(1000_00) // 10 x 100
    expect(r.finalBalance).toBe(1000_00)  // sem juros, bate com aportado
  })

  it('com rentabilidade positiva, patrimônio supera o aportado', () => {
    const r = simulateCompound({
      initialAmount: 1000_00,
      monthlyContribution: 100_00,
      months: 120,
      annualReturnPct: 10,
      annualDividendYieldPct: 0,
    })
    expect(r.finalBalance).toBeGreaterThan(r.totalInvested)
    expect(r.totalReturn).toBe(r.finalBalance - r.totalInvested)
  })

  it('projeta dividendos quando há DY', () => {
    const r = simulateCompound({
      initialAmount: 10000_00,
      monthlyContribution: 0,
      months: 12,
      annualReturnPct: 0,
      annualDividendYieldPct: 12, // 1% ao mês
    })
    // DY mensal ~1% sobre ~10000 => ~100/mês; acumulado ~1200 no ano
    expect(r.totalDividends).toBeGreaterThan(100_00)
    expect(r.monthlyDividendAtEnd).toBeGreaterThan(0)
  })

  it('months = 0 retorna apenas o valor inicial sem pontos', () => {
    const r = simulateCompound({
      initialAmount: 500_00,
      monthlyContribution: 100_00,
      months: 0,
      annualReturnPct: 10,
      annualDividendYieldPct: 5,
    })
    expect(r.points).toHaveLength(0)
    expect(r.finalBalance).toBe(500_00)
    expect(r.totalInvested).toBe(500_00)
  })
})
