import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { rateLimiter } from 'hono-rate-limiter'
import { FigmaToReact } from './core/figma/figma-react.js'
import { env, validateEnv, isProduction } from './config/env.js'
import { validateRequest, figmaRequestSchema } from './middleware/validation.js'
import { apiKeyAuth } from './middleware/security.js'
import { replaceBase64DataUrlsWithPrefix } from './utils/helpers.js'

validateEnv()

const app = new Hono()

app.use('*', logger())
app.use('*', secureHeaders({
  strictTransportSecurity: isProduction ? 'max-age=31536000; includeSubDomains' : false,
  xFrameOptions: 'DENY',
  xXssProtection: '1; mode=block',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    geolocation: [],
    microphone: [],
    camera: [],
  },
}))
app.use('*', cors({
  origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-api-key'],
  maxAge: 86400,
}))

app.use('*', rateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => {
    const apiKey = c.req.header('x-api-key')
    if (apiKey) return `api:${apiKey}`

    const forwarded = c.req.header('x-forwarded-for')
    return forwarded ? forwarded.split(',')[0].trim() : c.req.header('x-real-ip') || 'unknown'
  },
}))

app.use('*', apiKeyAuth())

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  })
})

app.post('/v1/api/vibe-figma', async (c) => {
  try {
    const validation = await validateRequest(c, figmaRequestSchema)
    if (!validation.success) {
      return validation?.response
    }

    const requestData = validation.data
    const {
      url,
      accessToken,
      authType,
      useTailwind,
      optimizeComponents,
      useCodeCleaner,
      generateClasses,
      useAbsolutePositioning,
      responsive,
      includeFonts,
    } = requestData

    const converter = new FigmaToReact(
      accessToken,
      authType,
      {
        useTailwind,
        optimizeComponents,
        useCodeCleaner,
        generateClasses,
        useAbsolutePositioning,
        responsive,
        includeFonts
      }
    )

    const result = await converter.convertFromUrl(url)

    if (!result) {
      return c.json({
        error: 'Conversion failed',
        message: 'Please check your Figma URL and access token.'
      }, 500)
    }

    return c.json({
      success: true,
      jsx: result.jsx,
      assets: replaceBase64DataUrlsWithPrefix(result.assets),
      componentName: result.componentName,
      fonts: result.fonts,
      css: result.css
    })

  } catch (error) {
    console.error('API Error:', error)

    // Handle timeout errors
    if (error instanceof Error && error.name === 'TimeoutError') {
      return c.json({
        error: 'Request timeout',
        message: `Request exceeded the maximum timeout of ${env.REQUEST_TIMEOUT_MS / 1000} seconds`
      }, 408)
    }

    return c.json({
      error: 'Internal server error',
      message: isProduction ? 'An unexpected error occurred' : (error instanceof Error ? error.message : 'Unknown error')
    }, 500)
  }
})

app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  }, 404)
})

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({
    error: 'Internal server error',
    message: isProduction ? 'An unexpected error occurred' : err.message
  }, 500)
})

export default app
