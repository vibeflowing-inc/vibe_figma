import { z } from 'zod'
import type { Context } from 'hono'

export const figmaRequestSchema = z.object({
  url: z.string().url('Invalid Figma URL').refine(
    (url) => url.includes('figma.com'),
    'URL must be a Figma link'
  ),
  accessToken: z.string().min(1, 'Access token is required'),
  authType: z.enum(['x-figma-token', 'authorization']).default('x-figma-token'),
  useTailwind: z.boolean().default(false),
  optimizeComponents: z.boolean().default(false),
  useCodeCleaner: z.boolean().default(false),
  generateClasses: z.boolean().default(true),
  useAbsolutePositioning: z.boolean().default(true),
  responsive: z.boolean().default(true),
  includeFonts: z.boolean().default(true),
})

export type FigmaRequest = z.infer<typeof figmaRequestSchema>

export async function validateRequest<T>(
  c: Context,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T; response?: Response } | { success: false; response: Response }> {
  try {
    const body = await c.req.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: c.json(
          {
            error: 'Validation failed',
            issues: error?.issues?.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          400
        ),
      }
    }

    return {
      success: false,
      response: c.json(
        {
          error: 'Invalid request body',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        400
      ),
    }
  }
}
