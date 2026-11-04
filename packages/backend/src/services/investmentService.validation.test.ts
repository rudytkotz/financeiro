import { describe, expect, it } from 'vitest'
import { validateInvestmentAccount } from './investmentService'

describe('validateInvestmentAccount', () => {
  it('rejects cards and investment accounts as custody targets', () => {
    expect(() => validateInvestmentAccount('cartao')).toThrow('Investimentos só podem ser vinculados a contas operacionais.')
    expect(() => validateInvestmentAccount('investimento')).toThrow('Investimentos só podem ser vinculados a contas operacionais.')
  })

  it('accepts operational account types', () => {
    expect(() => validateInvestmentAccount('corrente')).not.toThrow()
    expect(() => validateInvestmentAccount('poupanca')).not.toThrow()
    expect(() => validateInvestmentAccount('carteira')).not.toThrow()
    expect(() => validateInvestmentAccount('outro')).not.toThrow()
  })
})
