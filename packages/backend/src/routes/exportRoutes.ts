import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { exportTransactionsCsv } from '../services/exportService.js'
import { getUserId } from '../lib/auth.js'
import { parse } from '../lib/validation.js'

const exportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/export/transactions.csv', async (request, reply) => {
    const { month } = parse(exportQuerySchema, request.query)
    const csv = await exportTransactionsCsv(getUserId(request), month)
    const filename = month ? `transacoes-${month}.csv` : 'transacoes.csv'
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv)
  })
}

export default exportRoutes
