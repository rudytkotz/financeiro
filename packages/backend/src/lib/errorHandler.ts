import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { isServiceError } from './errors.js'

/**
 * Registra um error handler global que padroniza todas as respostas de erro
 * no formato `{ code, message }` (com `errors` opcional para detalhes de validação).
 *
 * Ordem de tratamento:
 *  1. ServiceError lançado pelos services → status/code/message próprios
 *  2. ZodError (validação) → 422 VALIDATION_ERROR com a lista de problemas
 *  3. Erros de validação do Fastify (JSON Schema) → 422
 *  4. Erros com statusCode conhecido (ex: 404/401) → repassa
 *  5. Qualquer outro → 500 INTERNAL_ERROR (logado, sem vazar detalhes)
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Erros de negócio padronizados
    if (isServiceError(error)) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message })
    }

    // 2. Erros de validação Zod
    if (error instanceof ZodError) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        errors: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }

    // 3. Erros de validação do Fastify (JSON Schema)
    if (error.validation) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        errors: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      })
    }

    // 4. Erros HTTP conhecidos (ex: payload muito grande, 404 de rota)
    const statusCode = error.statusCode ?? 500
    if (statusCode < 500) {
      return reply.status(statusCode).send({
        code: error.code ?? 'REQUEST_ERROR',
        message: error.message,
      })
    }

    // 5. Erro inesperado — logar completo, responder genérico
    request.log.error({ err: error }, 'Erro não tratado')
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno. Tente novamente mais tarde.',
    })
  })
}
