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
