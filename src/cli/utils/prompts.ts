import prompts from 'prompts'
import type { CliOptions } from '../types.js'

/**
 * Validate Figma URL format
 */
function isValidFigmaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('figma.com')
  } catch {
    return false
  }
}

/**
 * Prompt for missing required inputs
 */
export async function promptForMissingInputs(
  options: Partial<CliOptions>
): Promise<CliOptions> {
  const questions: prompts.PromptObject[] = []

  // Check for URL
  if (!options.url) {
    questions.push({
      type: 'text',
      name: 'url',
      message: 'Figma URL:',
      validate: (value: string) =>
        isValidFigmaUrl(value) || 'Please provide a valid Figma URL (e.g., https://www.figma.com/design/...)',
    })
  }

  // Check for access token (environment variable takes precedence)
  const envToken = process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN
  if (!options.token && !envToken) {
    questions.push({
      type: 'password',
      name: 'token',
      message: 'Figma access token:',
      validate: (value: string) => value.length > 0 || 'Access token is required',
    })
  }

  // Prompt for output paths if in interactive mode
  if (options.interactive) {
    questions.push(
      {
        type: 'text',
        name: 'component',
        message: 'Component output path:',
        initial: options.component || './src/components',
      },
      {
        type: 'text',
        name: 'assets',
        message: 'Assets directory:',
        initial: options.assets || './public',
      }
    )
  }

  // If no questions, return options as is
  if (questions.length === 0) {
    return {
      ...options,
      token: options.token || envToken,
    } as CliOptions
  }

  // Prompt user
  const answers = await prompts(questions, {
    onCancel: () => {
      console.log('\nOperation cancelled by user')
      process.exit(0)
    },
  })

  // Merge answers with options
  return {
    ...options,
    ...answers,
    token: answers.token || options.token || envToken,
  } as CliOptions
}

/**
 * Show conversion settings summary
 */
export function showConversionSummary(options: CliOptions): void {
  console.log('\nConversion Settings:')
  console.log('━'.repeat(50))
  console.log(`URL:          ${options.url}`)
  console.log(`Component:    ${options.component || './src/components'}`)
  console.log(`Assets:       ${options.assets || './public'}`)
  console.log(`Tailwind:     ${options.useTailwind ? 'Yes' : 'No'}`)
  console.log(`Optimize:     ${options.optimizeComponents ? 'Yes' : 'No'}`)
  console.log(`Clean Code:   ${options.useCodeCleaner ? 'Yes' : 'No'}`)
  console.log('━'.repeat(50))
  console.log()
}

/**
 * Resolve output paths based on component name
 */
export function resolveOutputPaths(
  options: CliOptions,
  componentName: string
): { component: string; css: string | undefined; assets: string } {
  // Handle component path - if it's a directory, append component name
  let component: string
  const componentPath = options.component || './src/components'

  // Normalize path separators to forward slash
  const normalizedPath = componentPath.replace(/\\/g, '/')

  // Check if path ends with / (indicating it's a directory)
  if (normalizedPath.endsWith('/')) {
    component = `${normalizedPath}${componentName}.tsx`
  } else {
    // Check if it has an extension, if not treat as directory
    const hasExtension = /\.(tsx?|jsx?)$/.test(normalizedPath)
    if (hasExtension) {
      component = componentPath
    } else {
      component = `${normalizedPath}/${componentName}.tsx`
    }
  }

  // If not using Tailwind, generate CSS path in same directory as component
  let css: string | undefined
  if (!options.useTailwind) {
    const componentDir = component.substring(0, component.lastIndexOf('/')) || '.'
    css = `${componentDir}/${componentName}.css`
  }

  const assets = options.assets || './public'

  return { component, css, assets }
}
