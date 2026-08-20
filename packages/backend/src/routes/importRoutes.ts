import type { FastifyPluginAsync } from 'fastify'
import {
  calculateReferenceMonth,
  checkDuplicate,
  saveImport,
  overwriteImport,
  listImports,
  resolvePortadorToDependents,
  insertStandaloneTransactions,
  type ImportTransaction,
  type ServiceError,
} from '../services/importService.js'

// ---------------------------------------------------------------------------
// JSON Schema for POST /api/imports body validation
// ---------------------------------------------------------------------------
const postImportsSchema = {
  body: {
    type: 'object',
    required: ['transactions'],
    properties: {
      transactions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['date', 'description', 'amount', 'categoryId'],
          properties: {
            date: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
            categoryId: { type: 'string' },
            dependentId: { type: ['string', 'null'] },
            portador: { type: ['string', 'null'] },
            installmentCurrent: { type: ['number', 'null'] },
            installmentTotal: { type: ['number', 'null'] },
          },
        },
      },
      referenceMonth: { type: 'string' },
      force: { type: 'boolean' },
    },
    additionalProperties: false,
  },
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isServiceError(err: unknown): err is ServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    'message' in err
  )
}

/**
 * Offsets a YYYY-MM string by N months (positive = future, negative = past).
 */
function offsetMonth(yearMonth: string, offset: number): string {
  const [yearStr, monthStr] = yearMonth.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10) - 1 + offset // 0-indexed

  // Normalize
  while (month < 0) {
    month += 12
    year -= 1
  }
  while (month > 11) {
    month -= 12
    year += 1
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`
}

interface ValidationError {
  index: number
  reasons: string[]
}

/**
 * Revalida transações server-side.
 * Retorna as transações válidas e a lista de erros de validação.
 */
function validateTransactions(
  items: Array<{ date: string; description: string; amount: number; categoryId: string; dependentId?: string | null }>
): { valid: ImportTransaction[]; errors: ValidationError[] } {
  const valid: ImportTransaction[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const reasons: string[] = []

    // Validate date (YYYY-MM-DD format)
    if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      reasons.push('Data inválida. Formato esperado: YYYY-MM-DD.')
    } else {
      const parsed = new Date(item.date)
      if (isNaN(parsed.getTime())) {
        reasons.push('Data inválida.')
      }
    }

    // Validate description (non-empty)
    if (!item.description || item.description.trim().length === 0) {
      reasons.push('Descrição não pode ser vazia.')
    }

    // Validate amount (non-zero)
    if (typeof item.amount !== 'number' || item.amount === 0) {
      reasons.push('Valor não pode ser zero.')
    }

    // Validate categoryId (non-empty)
    if (!item.categoryId || item.categoryId.trim().length === 0) {
      reasons.push('Categoria é obrigatória.')
    }

    if (reasons.length > 0) {
      errors.push({ index: i, reasons })
    } else {
      valid.push({
        date: item.date,
        description: item.description.trim(),
        amount: item.amount,
        categoryId: item.categoryId,
        dependentId: item.dependentId ?? null,
        portador: (item as any).portador ?? null,
        installmentCurrent: (item as any).installmentCurrent ?? null,
        installmentTotal: (item as any).installmentTotal ?? null,
      })
    }
  }

  return { valid, errors }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const importRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/imports — importar transações
  app.post('/api/imports', { schema: postImportsSchema }, async (request, reply) => {
    const body = request.body as {
      transactions: Array<{
        date: string
        description: string
        amount: number
        categoryId: string
        dependentId?: string | null
      }>
      referenceMonth?: string
      force?: boolean
    }

    // 1. Revalidar transações server-side
    const { valid, errors } = validateTransactions(body.transactions)

    if (valid.length === 0) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Nenhuma transação válida fornecida.',
        errors,
      })
    }

    try {
      // 2. Resolve portador names to dependent IDs (auto-create if needed)
      const portadorNames = valid
        .map((t) => t.portador)
        .filter((p): p is string => !!p && p.trim().length > 0)

      const portadorMap = await resolvePortadorToDependents(portadorNames)

      // Assign dependentId based on portador name
      for (const t of valid) {
        if (t.portador && !t.dependentId) {
          const depId = portadorMap.get(t.portador.toLowerCase())
          if (depId) {
            t.dependentId = depId
          }
        }
      }

      // 3. Usar referenceMonth do payload (escolhido pelo usuário) ou calcular
      const referenceMonth = body.referenceMonth && /^\d{4}-\d{2}$/.test(body.referenceMonth)
        ? body.referenceMonth
        : calculateReferenceMonth(valid)

      // 3b. Expandir parcelas: para cada transação com installment, gerar as parcelas faltantes
      //     em outros meses. Ex: 2/3 no mês X → gerar 1/3 no mês X-1 e 3/3 no mês X+1
      //     Parcelas de outros meses são inseridas SEM importId (não pertencem a este import)
      const otherMonthTransactions: ImportTransaction[] = []
      for (const t of valid) {
        if (t.installmentCurrent && t.installmentTotal && t.installmentTotal > 1) {
          const current = t.installmentCurrent
          const total = t.installmentTotal

          for (let i = 1; i <= total; i++) {
            if (i === current) continue // a parcela original já está em 'valid'

            const monthOffset = i - current
            const targetMonth = offsetMonth(referenceMonth, monthOffset)

            otherMonthTransactions.push({
              date: `${targetMonth}-01`,
              description: t.description,
              amount: t.amount,
              categoryId: t.categoryId,
              dependentId: t.dependentId,
              portador: t.portador,
              installmentCurrent: i,
              installmentTotal: total,
            })
          }
        }
      }

      // 'valid' contém apenas as transações do mês corrente (a parcela atual)
      const transactionsToSave = valid

      // 4. Se checkDuplicate retorna true e force !== true → retornar 409
      const isDuplicate = await checkDuplicate(referenceMonth)
      if (isDuplicate && body.force !== true) {
        return reply.status(409).send({
          isDuplicate: true,
          referenceMonth,
        })
      }

      let importRecord
      if (isDuplicate && body.force === true) {
        // 5. Se force = true → chamar overwriteImport
        importRecord = await overwriteImport(referenceMonth, transactionsToSave)
      } else {
        // 6. Caso contrário → chamar saveImport
        importRecord = await saveImport(transactionsToSave, referenceMonth)
      }

      // 7. Inserir parcelas de outros meses (sem importId)
      if (otherMonthTransactions.length > 0) {
        await insertStandaloneTransactions(otherMonthTransactions)
      }

      // 8. Retornar 201 com o registro de importação
      return reply.status(201).send(importRecord)
    } catch (err) {
      if (isServiceError(err)) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message })
      }
      throw err
    }
  })

  // GET /api/imports — histórico de importações
  app.get('/api/imports', async (_request, reply) => {
    const importsList = await listImports()
    return reply.send(importsList)
  })
}

export default importRoutes
