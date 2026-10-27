import { config } from 'dotenv'
import { z } from 'zod'

// Carrega o .env antes de validar
config()

/**
 * Schema das variáveis de ambiente. Falha rápido e com mensagem clara
 * se algo obrigatório estiver ausente ou inválido no boot da aplicação.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Banco de dados — obrigatório
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório.'),

  // Servidor
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Autenticação
  JWT_SECRET: z.string().min(1).optional(),

  // Integrações opcionais
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  BRAPI_TOKEN: z.string().optional(),

  // Origem permitida para CORS em produção (ex: https://app.exemplo.com)
  FRONTEND_URL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

// Em ambiente de teste (vitest) não exigimos as variáveis reais: os testes
// mockam o acesso ao banco, então usamos defaults seguros para não encerrar o
// processo durante a suíte.
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

function loadEnv(): Env {
  if (isTest) {
    return envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret',
    })
  }

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n')
    console.error(`❌ Variáveis de ambiente inválidas:\n${issues}`)
    process.exit(1)
  }

  const env = parsed.data

  // JWT_SECRET é obrigatório em produção; em dev usamos um fallback explícito.
  if (!env.JWT_SECRET && env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET é obrigatório em produção. Encerrando.')
    process.exit(1)
  }

  return env
}

export const env = loadEnv()

/** Segredo do JWT com fallback apenas para desenvolvimento local. */
export const jwtSecret =
  env.JWT_SECRET ?? 'financeiro-dev-secret-only-for-local-development'

export const isProduction = env.NODE_ENV === 'production'
export const isDev = env.NODE_ENV === 'development'
