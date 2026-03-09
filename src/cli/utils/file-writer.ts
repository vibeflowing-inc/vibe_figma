import { promises as fs } from 'fs'
import path from 'path'
import prompts from 'prompts'
import type { SavedFiles } from '../types.js'

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function confirmOverwrite(filePath: string, force?: boolean): Promise<boolean> {
  if (force) {
    return true
  }

  const response = await prompts({
    type: 'confirm',
    name: 'overwrite',
    message: `File ${filePath} already exists. Overwrite?`,
    initial: false,
  })

  return response.overwrite ?? false
}

function addFontsToComponent(jsx: string, fonts: string): string {
  if (!fonts || fonts.trim() === '') {
    return jsx
  }

  if (fonts.includes('<link')) {
    return `/*
 * Add this to your HTML head:
 * ${fonts.trim()}
 */

${jsx}`
  }

  return `/* Fonts: ${fonts.trim()} */

${jsx}`
}

/**
 * Add CSS import to component
 */
function addCssImport(jsx: string, componentPath: string, cssPath: string): string {
  // Calculate relative path from component to CSS
  const componentDir = path.dirname(componentPath)
  const relativeCssPath = path.relative(componentDir, cssPath).replace(/\\/g, '/')

  // Add ./ prefix if not already present
  const importPath = relativeCssPath.startsWith('.') ? relativeCssPath : `./${relativeCssPath}`

  return `import '${importPath}'\n\n${jsx}`
}

export async function saveComponent(
  jsx: string,
  componentPath: string,
  fonts: string,
  cssPath?: string,
  force?: boolean
): Promise<void> {
  const dir = path.dirname(componentPath)
  await ensureDir(dir)

  if (await fileExists(componentPath)) {
    const shouldOverwrite = await confirmOverwrite(componentPath, force)
    if (!shouldOverwrite) {
      throw new Error(`Skipped: ${componentPath} already exists`)
    }
  }

  let componentContent = addFontsToComponent(jsx, fonts)
  if (cssPath) {
    componentContent = addCssImport(componentContent, componentPath, cssPath)
  }

  await fs.writeFile(componentPath, componentContent, 'utf-8')
}

export async function saveCss(css: string, cssPath: string, force?: boolean): Promise<void> {
  const dir = path.dirname(cssPath)
  await ensureDir(dir)
  if (await fileExists(cssPath)) {
    const shouldOverwrite = await confirmOverwrite(cssPath, force)
    if (!shouldOverwrite) {
      throw new Error(`Skipped: ${cssPath} already exists`)
    }
  }
  await fs.writeFile(cssPath, css, 'utf-8')
}

async function saveAsset(
  filename: string,
  base64Data: string,
  assetsDir: string,
  force?: boolean
): Promise<string> {
  // Remove data URL prefix (e.g., data:image/png;base64,) or base64: prefix
  let cleanBase64 = base64Data
    .replace(/^data:image\/\w+;base64,/, '') // Remove full data URL
    .replace(/^base64:/, '') // Remove base64: prefix

  // Decode base64 to binary buffer
  const buffer = Buffer.from(cleanBase64, 'base64')

  await ensureDir(assetsDir)
  const assetPath = path.join(assetsDir, filename)

  if (await fileExists(assetPath)) {
    const shouldOverwrite = await confirmOverwrite(assetPath, force)
    if (!shouldOverwrite) {
      return assetPath
    }
  }

  // Write binary data
  await fs.writeFile(assetPath, buffer)

  return assetPath
}

export async function saveAssets(
  assets: Record<string, string>,
  assetsDir: string,
  force?: boolean
): Promise<string[]> {
  const savedPaths: string[] = []

  for (const [filename, base64Data] of Object.entries(assets)) {
    try {
      const savedPath = await saveAsset(filename, base64Data, assetsDir, force)
      savedPaths.push(savedPath)
    } catch (error) {
      console.error(`Failed to save asset ${filename}:`, error)
      // Continue with other assets
    }
  }

  return savedPaths
}

/**
 * Save all conversion results to files
 */
export async function saveConversionResults(
  result: {
    jsx: string
    assets: Record<string, string>
    css: string
    fonts: string
  },
  paths: {
    component: string
    css?: string
    assets: string
  },
  force?: boolean
): Promise<SavedFiles> {
  const savedFiles: SavedFiles = {
    component: '',
    assets: [],
  }
  const willSaveCss = paths.css && result.css && result.css.trim() !== ''
  await saveComponent(
    result.jsx,
    paths.component,
    result.fonts,
    willSaveCss ? paths.css : undefined,
    force
  )
  savedFiles.component = paths.component

  if (willSaveCss && paths.css) {
    await saveCss(result.css, paths.css, force)
    savedFiles.css = paths.css
  }

  if (Object.keys(result.assets).length > 0) {
    savedFiles.assets = await saveAssets(result.assets, paths.assets, force)
  }

  return savedFiles
}
