import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { transactions, categories, dependents, accounts } from '../db/schema.js'

/** Escapa um campo para CSV (aspas duplas + wrap se necessário). */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatAmount(cents: number): string {
  // pt-BR: vírgula decimal, sem separador de milhar (facilita reimportação)
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Exporta transações do usuário em CSV (separador ';' — padrão aceito pelo Excel pt-BR).
 * Se `month` for informado, filtra por referenceMonth.
 */
export async function exportTransactionsCsv(userId: string, month?: string): Promise<string> {
  const conds = [eq(transactions.userId, userId)]
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conds.push(eq(transactions.referenceMonth, month))
  }

  const rows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      kind: transactions.kind,
      paymentMethod: transactions.paymentMethod,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      referenceMonth: transactions.referenceMonth,
      categoryName: categories.name,
      dependentName: dependents.name,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(dependents, eq(transactions.dependentId, dependents.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conds))
    .orderBy(sql`${transactions.date} DESC`)

  const header = [
    'Data', 'Descrição', 'Valor', 'Tipo', 'Forma de pagamento',
    'Parcela', 'Mês de referência', 'Categoria', 'Dependente', 'Conta',
  ].join(';')

  const lines = rows.map((r) => {
    const parcela = r.installmentCurrent && r.installmentTotal ? `${r.installmentCurrent}/${r.installmentTotal}` : ''
    return [
      csvField(r.date),
      csvField(r.description),
      csvField(formatAmount(r.amount)),
      csvField(r.kind === 'receita' ? 'Receita' : 'Despesa'),
      csvField(r.paymentMethod),
      csvField(parcela),
      csvField(r.referenceMonth),
      csvField(r.categoryName),
      csvField(r.dependentName),
      csvField(r.accountName),
    ].join(';')
  })

  // BOM para o Excel reconhecer UTF-8 corretamente
  return '\uFEFF' + [header, ...lines].join('\r\n')
}
