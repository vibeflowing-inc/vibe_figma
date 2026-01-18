import type { Context, Next } from 'hono'
import { env } from '../config/env'

export function apiKeyAuth() {
  return async (c: Context, next: Next) => {
    // Skip if API_KEY is not configured
    if (!env.API_KEY) {
      await next()
      return
    }

    const providedKey = c.req.header('x-api-key')

    if (!providedKey || providedKey !== env.API_KEY) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or missing API key',
        },
        401
      )
    }

    await next()
  }
}
