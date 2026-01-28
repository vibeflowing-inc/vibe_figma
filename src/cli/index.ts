#!/usr/bin/env node

import 'dotenv/config'
import { Command } from 'commander'
import { convertCommand } from './commands/convert.js'
import type { CliOptions } from './types.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))

const program = new Command()

program
  .name('vibefigma')
  .description('Convert Figma designs to React components')
  .version(packageJson.version)

// Main command with URL as optional argument
program
  .argument('[url]', 'Figma file/node URL')
  .option('-t, --token <token>', 'Figma access token (overrides FIGMA_TOKEN env var)')
  .option('-u, --url <url>', 'Figma file/node URL')
  .option('-c, --component <path>', 'Component output path (default: ./src/components/[ComponentName].tsx)')
  .option('-a, --assets <dir>', 'Assets directory (default: ./public)')
  .option('--no-tailwind', 'Disable Tailwind CSS (enabled by default)')
  .option('--optimize', 'Optimize components', false)
  .option('--clean', 'Use AI code cleaner', false)
  .option('--no-classes', 'Don\'t generate CSS classes')
  .option('--no-absolute', 'Don\'t use absolute positioning')
  .option('--no-responsive', 'Disable responsive design')
  .option('--no-fonts', 'Don\'t include fonts')
  .option('--interactive', 'Force interactive mode', false)
  .option('-f, --force', 'Overwrite existing files without confirmation', false)
  .action(async (urlArg: string | undefined, options: any) => {
    // Merge URL argument with options
    const cliOptions: CliOptions = {
      url: urlArg || options.url,
      token: options.token,
      component: options.component,
      assets: options.assets,
      useTailwind: options.tailwind !== false,
      optimizeComponents: options.optimize,
      useCodeCleaner: options.clean,
      generateClasses: options.classes !== false,
      useAbsolutePositioning: options.absolute !== false,
      responsive: options.responsive !== false,
      includeFonts: options.fonts !== false,
      interactive: options.interactive,
      force: options.force,
    }

    await convertCommand(cliOptions)
  })

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n\nOperation cancelled by user')
  process.exit(0)
})

// Parse arguments
program.parse()
