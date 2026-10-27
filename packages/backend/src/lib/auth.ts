import type { FastifyRequest } from 'fastify'

/** Payload que armazenamos no JWT. */
export interface AuthUser {
  id: string
  username: string
  isAdmin: boolean
}

/**
 * Extrai o usuário autenticado da requisição.
 * Assume que o hook de autenticação já validou o JWT (ver `server.ts`).
 */
export function getAuthUser(request: FastifyRequest): AuthUser {
  return request.user as AuthUser
}

/** Atalho para obter apenas o id do usuário autenticado. */
export function getUserId(request: FastifyRequest): string {
  return getAuthUser(request).id
}
