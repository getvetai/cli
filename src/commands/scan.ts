import { readFileSync, existsSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { analyzeSkill } from '../utils/analyzer.js'
import { analyzeMcp } from '../utils/mcp-analyzer.js'
import { displayScanReport } from '../utils/display.js'
import { lookupTool, requestDeepScan } from '../utils/api.js'
import type { AnalysisResult } from '../types.js'

function detect(t: string): 'url' | 'npm' | 'file' | 'github' {
  if (/^https?:\/\/github\.com\//.test(t)) return 'github'
  if (/^https?:\/\//.test(t)) return 'url'
  if (existsSync(t)) return 'file'
  return 'npm'
}

export async function scanCommand(target: string, options: { json?: boolean; overview?: boolean; offline?: boolean; deep?: boolean }): Promise<void> {
  const spinner = ora('Analyzing...').start()
  try {
    const tt = detect(target)
    let result: AnalysisResult
    let registrySlug: string | undefined

    // Try registry lookup first for npm packages (unless --offline)
    if (tt === 'npm' && !options.offline) {
      spinner.text = `Checking Vet registry for ${target}...`
      const registryData = await lookupTool(target)

      if (registryData && registryData.scanTier === 'deep') {
        spinner.succeed(chalk.green('✓ Found in Vet registry (deep scan available)'))
        registrySlug = registryData.slug || target
        result = {
          name: registryData.name || target,
          description: registryData.description,
          type: registryData.type || 'mcp',
          transport: registryData.transport,
          runtime: registryData.runtime,
          tools: registryData.tools || [],
          permissions: registryData.permissions || [],
          issues: registryData.issues || [],
          trustScore: registryData.trustScore ?? registryData.trust_score ?? 50,
          badge: registryData.badge || 'unverified',
          codeQuality: registryData.codeQuality || { hasTests: false, hasDocs: false, linesOfCode: 0 },
          riskFactors: registryData.riskFactors || [],
          overview: registryData.overview,
          envVars: registryData.envVars,
        }

        if (options.json) console.log(JSON.stringify(result, null, 2))
        else displayScanReport(result, registrySlug)
        process.exitCode = result.badge === 'flagged' ? 1 : 0
        return
      }

      if (registryData) {
        registrySlug = registryData.slug || target
        console.log(chalk.cyan(`  ℹ Found in Vet registry (indexed) — running local analysis too`))
        console.log(chalk.gray(`  View: https://getvet.ai/catalog/${registrySlug}`))
        console.log()
      }
    }

    // Deep scan request
    if (options.deep && tt === 'npm') {
      spinner.text = `Requesting deep scan for ${target}...`
      const deepResult = await requestDeepScan(target)
      if (deepResult) {
        spinner.succeed(chalk.green('✓ Deep scan requested'))
        if (deepResult.status === 'queued') {
          console.log(chalk.gray(`  Deep scan queued. Check back soon at https://getvet.ai/catalog/${target}`))
        }
      } else {
        spinner.info('Deep scan request failed — proceeding with local analysis')
      }
    }

    // Local analysis (current behavior)
    if (tt === 'npm') {
      spinner.text = `Fetching npm: ${target}`
      result = await analyzeMcp({ npmPackage: target })
    } else if (tt === 'github') {
      spinner.text = `Fetching GitHub: ${target}`
      result = await analyzeMcp({ githubUrl: target })
    } else if (tt === 'url') {
      spinner.text = `Fetching: ${target}`
      const resp = await fetch(target, { headers: { 'User-Agent': 'Vet/1.0' } })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const content = await resp.text()
      result = target.endsWith('SKILL.md') ? analyzeSkill(content) : await analyzeMcp({ readme: content, name: target.split('/').pop()?.replace(/\.(md|json)$/, '') })
    } else {
      const content = readFileSync(target, 'utf-8')
      result = target.endsWith('SKILL.md') ? analyzeSkill(content)
        : (content.includes('MCP') || target.includes('mcp')) ? await analyzeMcp({ readme: content, name: target.split('/').pop()?.replace(/\.(md|json)$/, '') })
        : analyzeSkill(content)
    }

    spinner.stop()
    if (options.json) console.log(JSON.stringify(result, null, 2))
    else displayScanReport(result, registrySlug)
    process.exitCode = result.badge === 'flagged' ? 1 : 0
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`)
    process.exitCode = 2
  }
}
