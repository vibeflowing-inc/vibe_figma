import { FigmaToReact } from '../../core/figma/figma-react.js'
import { logger } from '../utils/logger.js'
import { promptForMissingInputs, showConversionSummary, resolveOutputPaths } from '../utils/prompts.js'
import { saveConversionResults } from '../utils/file-writer.js'
import type { CliOptions } from '../types.js'

/**
 * Main conversion command
 */
export async function convertCommand(options: CliOptions): Promise<void> {
  try {
    logger.showBanner()
    const needsInteractive = options.interactive || !options.url || (!options.token && !process.env.FIGMA_TOKEN && !process.env.FIGMA_ACCESS_TOKEN)
    let finalOptions = options
    if (needsInteractive) {
      finalOptions = await promptForMissingInputs(options)
    } else {
      finalOptions.token = finalOptions.token || process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN
    }
    if (!finalOptions.url) {
      throw new Error('Figma URL is required. Use --url or --interactive flag.')
    }

    if (!finalOptions.token) {
      throw new Error('Figma access token is required. Set FIGMA_TOKEN environment variable or use --token flag.')
    }
    showConversionSummary(finalOptions)
    logger.startSpinner('Fetching Figma design...')

    // Create converter instance
    const converter = new FigmaToReact(
      finalOptions.token,
      'x-figma-token',
      {
        useTailwind: finalOptions.useTailwind ?? true,
        optimizeComponents: finalOptions.optimizeComponents ?? false,
        useCodeCleaner: finalOptions.useCodeCleaner ?? false,
        generateClasses: finalOptions.generateClasses ?? true,
        useAbsolutePositioning: finalOptions.useAbsolutePositioning ?? true,
        responsive: finalOptions.responsive ?? true,
        includeFonts: finalOptions.includeFonts ?? true,
      }
    )

    // Convert from URL
    logger.updateSpinner('Converting Figma design to React...')
    const result = await converter.convertFromUrl(finalOptions.url)

    if (!result) {
      throw new Error('Conversion failed. Please check your Figma URL and access token.')
    }
    logger.succeedSpinner('Conversion complete!')
    const paths = resolveOutputPaths(finalOptions, result.componentName)
    const savedFiles = await saveConversionResults(
      {
        jsx: result.jsx,
        assets: result.assets,
        css: result.css,
        fonts: result.fonts,
      },
      paths
    )

    logger.showSummary(savedFiles)

  } catch (error) {
    logger.stopSpinner()

    if (error instanceof Error) {
      logger.showError(error)
    } else {
      logger.error('An unexpected error occurred')
      console.error(error)
    }

    process.exit(1)
  }
}
