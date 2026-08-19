import type { FastifyPluginAsync } from 'fastify'
import {
  calculateReferenceMonth,
  checkDuplicate,
  saveImport,
  overwriteImport,
  listImports,
  resolvePortadorToDependents,
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

    // Validate amount (> 0)
    if (typeof item.amount !== 'number' || item.amount <= 0) {
      reasons.push('Valor deve ser maior que zero.')
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

      // 3. Calcular referenceMonth com calculateReferenceMonth
      const referenceMonth = calculateReferenceMonth(valid)

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
        importRecord = await overwriteImport(referenceMonth, valid)
      } else {
        // 6. Caso contrário → chamar saveImport
        importRecord = await saveImport(valid)
      }

      // 7. Retornar 201 com o registro de importação
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
