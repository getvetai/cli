import { resolve } from 'path'
import ora from 'ora'
import { discoverTools } from '../utils/config.js'
import { analyzeSkill } from '../utils/analyzer.js'
import { analyzeMcp } from '../utils/mcp-analyzer.js'
import { displayAuditReport } from '../utils/display.js'
import type { AnalysisResult } from '../types.js'

export async function auditCommand(path: string | undefined, options: { json?: boolean; strict?: boolean; fix?: boolean }): Promise<void> {
  const pp = resolve(path || '.')
  const spinner = ora(`Scanning ${pp}...`).start()
  try {
    const { tools, sources } = discoverTools(pp)
    if (!tools.length) { spinner.info('No AI tools found.'); return }
    spinner.text = `Found ${tools.length} tools...`
    const results: AnalysisResult[] = []
    for (const t of tools) {
      spinner.text = `Analyzing ${t.name}...`
      try {
        if (t.type === 'skill' && t.content) results.push(analyzeSkill(t.content, t.name))
        else if (t.type === 'mcp-package' || t.type === 'mcp-config') results.push(await analyzeMcp({ npmPackage: t.target }))
        else results.push(analyzeSkill('', t.name))
      } catch {
        results.push({ name: t.name, permissions: [], issues: [{ severity: 'warning', message: 'Analysis failed' }], trustScore: 0, badge: 'unverified', codeQuality: { hasTests: false, hasDocs: false, linesOfCode: 0 }, riskFactors: [] })
      }
    }
    spinner.stop()
    if (options.json) console.log(JSON.stringify({ sources, results }, null, 2))
    else displayAuditReport(results, sources)
    process.exitCode = options.strict
      ? (results.some(r => r.badge === 'unverified' || r.badge === 'flagged') ? 1 : 0)
      : (results.some(r => r.badge === 'flagged') ? 1 : 0)
  } catch (err) {
    spinner.fail(`Failed: ${(err as Error).message}`)
    process.exitCode = 2
  }
}
