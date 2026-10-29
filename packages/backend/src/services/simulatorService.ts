import type { CompoundSimInput, CompoundSimResult, CompoundSimPoint } from '@financeiro/shared'

/**
 * Simulação de juros compostos com aportes mensais e projeção de proventos.
 *
 * Modelo (valores em centavos):
 *  - taxa mensal = (1 + anual/100)^(1/12) - 1
 *  - a cada mês: saldo cresce pela taxa, soma o aporte mensal
 *  - dividendos do mês = saldo * (DY anual / 12), apenas projeção (não reinvestidos
 *    automaticamente — mostramos a renda passiva estimada)
 *
 * Tudo puro e determinístico (fácil de testar).
 */
export function simulateCompound(input: CompoundSimInput): CompoundSimResult {
  const months = Math.max(0, Math.floor(input.months))
  const monthlyRate = Math.pow(1 + input.annualReturnPct / 100, 1 / 12) - 1
  const monthlyDy = input.annualDividendYieldPct / 100 / 12

  let balance = input.initialAmount
  let invested = input.initialAmount
  let accumulatedDividends = 0
  const points: CompoundSimPoint[] = []

  for (let m = 1; m <= months; m++) {
    // valoriza o saldo e aporta
    balance = Math.round(balance * (1 + monthlyRate))
    balance += input.monthlyContribution
    invested += input.monthlyContribution

    const dividends = Math.round(balance * monthlyDy)
    accumulatedDividends += dividends

    points.push({ month: m, invested, balance, dividends, accumulatedDividends })
  }

  const finalBalance = points.length ? points[points.length - 1].balance : input.initialAmount
  const totalInvested = points.length ? points[points.length - 1].invested : input.initialAmount
  const monthlyDividendAtEnd = Math.round(finalBalance * monthlyDy)

  return {
    points,
    finalBalance,
    totalInvested,
    totalReturn: finalBalance - totalInvested,
    totalDividends: accumulatedDividends,
    monthlyDividendAtEnd,
  }
}
