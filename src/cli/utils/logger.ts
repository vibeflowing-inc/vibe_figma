import chalk from 'chalk'
import ora, { type Ora } from 'ora'

// Create gradient banner with 3D blocky effect using Figma brand colors (ultra-smooth gradient, lighter tones)
const createBanner = () => {
  const colors = [
    '#FF8A7A', '#FF9382', '#FF9C8A', '#FFA592', '#FFAE9A', '#FFB7A2', '#FFC0AA',
    '#FFC4B8', '#FFC8C6', '#FFCCD4', '#FFD0E2', '#F5C4E6', '#EBB8EA', '#E1ACEE',
    '#D7A0F2', '#CD94F6', '#C388FA', '#B97CFE', '#AF70FF', '#A564FF', '#9B5EFF',
    '#9168FF', '#8772FF', '#7D7CFF', '#7386FF', '#6990FF', '#5F9AFF', '#55A4FF',
    '#4BAEFF', '#41B8FF', '#4EC2FF', '#5BCCFF', '#68D6FF', '#75E0FF', '#82EAFF',
    '#8AEEDE', '#92F2BC', '#9AF69A', '#8EF5A0', '#82F4A6', '#76F3AC', '#6AF2B2'
  ]

  const lines = [
    '  ██╗   ██╗██╗██████╗ ███████╗███████╗██╗ ██████╗ ███╗   ███╗ █████╗',
    '  ██║   ██║██║██╔══██╗██╔════╝██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗',
    '  ██║   ██║██║██████╔╝█████╗  █████╗  ██║██║  ███╗██╔████╔██║███████║',
    '  ╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██╔══╝  ██║██║   ██║██║╚██╔╝██║██╔══██║',
    '   ╚████╔╝ ██║██████╔╝███████╗██║     ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║',
    '    ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝'
  ]

  const gradientLines = lines.map(line => {
    const chars = line.split('')
    const step = Math.max(1, Math.floor(chars.length / colors.length))

    return chars.map((char, i) => {
      const colorIndex = Math.min(Math.floor(i / step), colors.length - 1)
      return chalk.hex(colors[colorIndex])(char)
    }).join('')
  })

  return '\n' + gradientLines.join('\n') + '\n\n' +
    chalk.hex('#666')('  ╔═══════════════════════════════════════════════════════════════════════════════════╗') + '\n' +
    chalk.hex('#666')('  ║  ') + chalk.hex('#F24E1E')('Figma') + chalk.hex('#A259FF')(' → ') + chalk.hex('#1ABCFE')('React + Tailwind') + chalk.hex('#555')('  │  ') + chalk.hex('#999')('Design to Code in seconds') + chalk.hex('#777')(' • ') + chalk.hex('#1ABCFE')('https://vibeflow.ai') + chalk.hex('#666')('     ║') + '\n' +
    chalk.hex('#666')('  ╚═══════════════════════════════════════════════════════════════════════════════════╝') + '\n'
}


export class Logger {
  private spinner: Ora | null = null

  showBanner() {
    console.log(createBanner())
  }

  info(message: string) {
    console.log(chalk.blue('ℹ'), message)
  }

  success(message: string) {
    console.log(chalk.green('✓'), message)
  }

  warning(message: string) {
    console.log(chalk.yellow('⚠'), message)
  }

  error(message: string) {
    console.log(chalk.red('✖'), message)
  }

  startSpinner(text: string) {
    this.spinner = ora({
      text,
      color: 'cyan',
    }).start()
  }

  updateSpinner(text: string) {
    if (this.spinner) {
      this.spinner.text = text
    }
  }

  succeedSpinner(text?: string) {
    if (this.spinner) {
      this.spinner.succeed(text)
      this.spinner = null
    }
  }

  failSpinner(text?: string) {
    if (this.spinner) {
      this.spinner.fail(text)
      this.spinner = null
    }
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop()
      this.spinner = null
    }
  }

  showSummary(files: { component: string; css?: string; assets: string[] }) {
    console.log()
    console.log(chalk.green.bold('✨ Conversion complete!'))
    console.log()
    console.log(chalk.bold('Files created:'))
    console.log(chalk.cyan('  • Component:'), files.component)

    if (files.css) {
      console.log(chalk.cyan('  • CSS:'), files.css)
    }

    if (files.assets.length > 0) {
      console.log(chalk.cyan('  • Assets:'), `${files.assets.length} file(s)`)
      if (files.assets.length <= 5) {
        files.assets.forEach(asset => {
          console.log(chalk.gray(`    - ${asset}`))
        })
      } else {
        files.assets.slice(0, 3).forEach(asset => {
          console.log(chalk.gray(`    - ${asset}`))
        })
        console.log(chalk.gray(`    ... and ${files.assets.length - 3} more`))
      }
    }
    console.log()
  }

  showError(error: Error) {
    console.log()
    console.log(chalk.red.bold('ERROR:'), chalk.red(error.message))

    if (error.message.includes('Invalid access token') || error.message.includes('401') || error.message.includes('403')) {
      console.log()
      console.log(chalk.yellow('Solution:'))
      console.log('1. Check your Figma access token')
      console.log('2. Generate a new token at: https://www.figma.com/developers/api#access-tokens')
      console.log('3. Ensure the token has read access to the file')
    } else if (error.message.includes('Invalid Figma URL') || error.message.includes('URL must be a Figma link')) {
      console.log()
      console.log(chalk.yellow('Solution:'))
      console.log('Provide a valid Figma URL in the format:')
      console.log('https://www.figma.com/design/[FILE_KEY]/[FILE_NAME]')
      console.log('https://www.figma.com/file/[FILE_KEY]/[FILE_NAME]')
    } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
      console.log()
      console.log(chalk.yellow('Solution:'))
      console.log('Check file permissions for the output directory')
    }

    console.log()
    console.log(chalk.gray('Run'), chalk.cyan('vibefigma --help'), chalk.gray('for more information'))
    console.log()
  }
}

export const logger = new Logger()
