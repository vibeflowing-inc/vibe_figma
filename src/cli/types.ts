export interface CliOptions {
  url?: string
  token?: string
  component?: string
  assets?: string
  useTailwind?: boolean
  optimizeComponents?: boolean
  useCodeCleaner?: boolean
  generateClasses?: boolean
  useAbsolutePositioning?: boolean
  responsive?: boolean
  includeFonts?: boolean
  interactive?: boolean
}

export interface ConversionResult {
  jsx: string
  assets: Record<string, string>
  componentName: string
  fonts: string
  css: string
}

export interface SavedFiles {
  component: string
  css?: string
  assets: string[]
}
