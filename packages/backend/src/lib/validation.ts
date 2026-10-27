import type { ZodSchema } from 'zod'

/**
 * Valida um valor contra um schema Zod e retorna o dado tipado.
 * Em caso de falha, lança `ZodError`, que é convertido em 422 pelo
 * error handler global (ver `lib/errorHandler.ts`).
 *
 * Uso nas rotas:
 *   const body = parse(createTransactionSchema, request.body)
 */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}
