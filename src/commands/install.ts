import { createInterface } from 'readline'
import { execSync } from 'child_process'
import ora from 'ora'
import chalk from 'chalk'
import { analyzeMcp } from '../utils/mcp-analyzer.js'
import { displayScanReport } from '../utils/display.js'

async function confirm(msg: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(res => {
    rl.question(msg, a => { rl.close(); res(a.toLowerCase() === 'y' || a.toLowerCase() === 'yes') })
  })
}

export async function installCommand(pkg: string, options: { json?: boolean; global?: boolean; skill?: boolean }): Promise<void> {
  const spinner = ora(`Auditing ${pkg}...`).start()
  try {
    const result = await analyzeMcp({ npmPackage: pkg })
    spinner.stop()
    displayScanReport(result)

    if (result.badge === 'flagged') {
      console.log(chalk.red.bold('  ⚠️  This package has been flagged!'))
      if (!await confirm(chalk.yellow('  Install anyway? (y/N) '))) {
        console.log(chalk.gray('  Cancelled.'))
        process.exitCode = 1
        return
      }
    }

    const s2 = ora(`Installing ${pkg}...`).start()
    try {
      if (options.skill) execSync(`npx clawhub install ${pkg}`, { stdio: 'pipe' })
      else execSync(`npm install${options.global ? ' -g' : ''} ${pkg}`, { stdio: 'pipe' })
      s2.succeed(`${pkg} installed`)
    } catch (e) {
      s2.fail(`Install failed: ${(e as Error).message}`)
      process.exitCode = 1
    }
  } catch (err) {
    spinner.fail(`Audit failed: ${(err as Error).message}`)
    process.exitCode = 2
  }
}
