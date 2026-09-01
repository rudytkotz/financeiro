import { describe, it, expect } from 'vitest'
import { parseCsvString } from './parseCsv'

describe('parseCsvString — casos de borda', () => {
  it('arquivo vazio retorna 0 válidas', () => {
    const result = parseCsvString('')
    expect(result.valid).toHaveLength(0)
  })

  it('todas as linhas inválidas retorna 0 válidas e invalidCount > 0', () => {
    const csv = [
      'data,descrição,valor',
      'invalid-date,Compra,100.00',
      '2024-01-15,,50.00',
      '2024-02-10,Mercado,-10.00',
    ].join('\n')

    const result = parseCsvString(csv)
    expect(result.valid).toHaveLength(0)
    expect(result.invalidCount).toBeGreaterThan(0)
  })

  it('campo valor com vírgula decimal "123,45" é interpretado corretamente', () => {
    const csv = [
      'data,descrição,valor',
      '2024-03-01,Mercado,123,45',
    ].join('\n')

    // PapaParse splits on commas, so "123,45" might be parsed differently.
    // Let's test with the value quoted to represent a real comma-decimal value:
    const csvQuoted = [
      'data,descrição,valor',
      '2024-03-01,Mercado,"123,45"',
    ].join('\n')

    const result = parseCsvString(csvQuoted)
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].amount).toBe(12345) // 123.45 reais = 12345 centavos
  })

  it('datas em formatos mistos (YYYY-MM-DD e DD/MM/YYYY no mesmo arquivo)', () => {
    const csv = [
      'data,descrição,valor',
      '2024-01-15,Compra A,50.00',
      '20/02/2024,Compra B,75.00',
    ].join('\n')

    const result = parseCsvString(csv)
    expect(result.valid).toHaveLength(2)
    expect(result.valid[0].date).toBe('2024-01-15')
    expect(result.valid[1].date).toBe('2024-02-20')
  })

  it('cabeçalho presente mas sem dados retorna 0 válidas', () => {
    const csv = 'data,descrição,valor\n'
    const result = parseCsvString(csv)
    expect(result.valid).toHaveLength(0)
    expect(result.invalidCount).toBe(0)
  })

  it('CSV com BOM é processado corretamente', () => {
    const csv = '\uFEFFdata,descrição,valor\n2024-05-10,Almoço,25.00'
    const result = parseCsvString(csv)
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].date).toBe('2024-05-10')
    expect(result.valid[0].description).toBe('Almoço')
    expect(result.valid[0].amount).toBe(2500)
  })
})

describe('parseCsvString — formato Bradesco/Amex (semicolon, Valor em R$)', () => {
  const bradescoCsv = [
    'Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)',
    '08/08/2026;RUDY TKOTZ;3853;-;Estorno Tarifa;Única;0;0;-98.00',
    '08/08/2026;RUDY TKOTZ;3853;-;Anuidade Diferenciada;3/12;0;0;98.00',
    '12/07/2026;RUDY TKOTZ;7424;T&E Companhia aérea;GOL LINHAS A*CLSQJJ018;2/3;0;0;110.46',
    '13/07/2026;RUDY TKOTZ;7424;Transporte;123 VIAGENS E TURISMO;Única;0;0;971.36',
    '29/07/2026;RUDY TKOTZ;7424;Transporte;VAI DE PROMO*PROMO;Única;0;0;718.18',
  ].join('\n')

  it('parseia todas as 5 linhas como válidas', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid).toHaveLength(5)
    expect(result.invalidCount).toBe(0)
  })

  it('detecta data no formato DD/MM/YYYY e converte para YYYY-MM-DD', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[0].date).toBe('2026-08-08')
    expect(result.valid[2].date).toBe('2026-07-12')
  })

  it('portador é preenchido a partir de Nome no Cartão', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[0].portador).toBe('RUDY TKOTZ')
  })

  it('estorno com valor negativo é preservado como negativo', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[0].amount).toBe(-9800) // -98.00 BRL
  })

  it('Parcela "Única" resulta em sem installment', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[0].installmentCurrent).toBeUndefined()
    expect(result.valid[0].installmentTotal).toBeUndefined()
    expect(result.valid[3].installmentCurrent).toBeUndefined()
  })

  it('Parcela "3/12" é parseada corretamente', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[1].installmentCurrent).toBe(3)
    expect(result.valid[1].installmentTotal).toBe(12)
    expect(result.valid[1].installment).toBe('3/12')
  })

  it('valores monetários são convertidos para centavos corretamente', () => {
    const result = parseCsvString(bradescoCsv)
    expect(result.valid[1].amount).toBe(9800)   // 98.00
    expect(result.valid[2].amount).toBe(11046)  // 110.46
    expect(result.valid[3].amount).toBe(97136)  // 971.36
    expect(result.valid[4].amount).toBe(71818)  // 718.18
  })
})
