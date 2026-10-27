/**
 * Erro de serviço padronizado em toda a aplicação.
 *
 * Os services lançam `ServiceError` via `makeError(...)` e o error handler
 * global (ver `server.ts`) converte para uma resposta HTTP `{ code, message }`.
 */
export interface ServiceError {
  statusCode: number
  code: string
  message: string
}

/** Cria um `ServiceError` tipado. */
export function makeError(statusCode: number, code: string, message: string): ServiceError {
  return { statusCode, code, message }
}

/** Type guard: verifica se um erro desconhecido é um `ServiceError`. */
export function isServiceError(err: unknown): err is ServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    'message' in err
  )
}
