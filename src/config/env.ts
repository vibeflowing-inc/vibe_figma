import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // CORS Configuration
  CORS_ORIGIN: z.string().default('*'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),

  // Request Limits
  MAX_REQUEST_SIZE: z.string().default('10mb'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(300000), // 5 minutes

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // API Configuration
  API_KEY: z.string().optional(),

  // Feature Flags
  ENABLE_METRICS: z.coerce.boolean().default(false),
})

function parseEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Environment validation failed:')
    console.error(parsed.error.format())
    throw new Error('Invalid environment configuration')
  }

  return parsed.data
}

export const env = parseEnv()

export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'

// Additional validation warnings for production
export function validateEnv() {
  if (isProduction) {
    if (env.CORS_ORIGIN === '*') {
      console.warn('⚠️  WARNING: CORS is set to allow all origins in production. Set CORS_ORIGIN environment variable.')
    }

    if (env.RATE_LIMIT_MAX_REQUESTS > 100) {
      console.warn('⚠️  WARNING: Rate limit is set very high. Consider lowering RATE_LIMIT_MAX_REQUESTS.')
    }
  }

  return true
}
