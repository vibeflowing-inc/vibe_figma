import chalk from 'chalk'
import ora, { type Ora } from 'ora'

const BANNER = `
 _   _ _ _          _____ _
| | | (_) |__   ___|  ___(_) __ _ _ __ ___   __ _
| | | | | '_ \\ / _ \\ |_  | |/ _\` | '_ \` _ \\ / _\` |
| |_| | | |_) |  __/  _| | | (_| | | | | | | (_| |
 \\___/|_|_.__/ \\___|_|   |_|\\__, |_| |_| |_|\\__,_|
                            |___/

${chalk.cyan('          by vibeflow.ai')}
`

export class Logger {
  private spinner: Ora | null = null

  showBanner() {
    console.log(chalk.magenta(BANNER))
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
