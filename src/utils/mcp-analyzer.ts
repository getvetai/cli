import type { Permission, SecurityIssue, CodeQuality, BadgeType, McpTool, McpToolParam, Transport, AnalysisResult, RiskLevel } from '../types.js'

const TOOL_RULES: { paramPattern: RegExp | null; namePattern: RegExp | null; type: string; risk: RiskLevel }[] = [
  { paramPattern: /\bcommand\b|\bcmd\b|\bshell\b/i, namePattern: /\bexec\b|\brun\b|\bshell\b/i, type: 'exec:shell', risk: 'critical' },
  { paramPattern: /\burl\b|\bendpoint\b|\bhref\b/i, namePattern: /\bfetch\b|\brequest\b|\bhttp\b/i, type: 'net:outbound', risk: 'medium' },
  { paramPattern: /\bpath\b|\bfile\b|\bfilename\b|\bdirectory\b/i, namePattern: /\bread\b|\bget\b|\blist\b|\bsearch\b/i, type: 'fs:read', risk: 'medium' },
  { paramPattern: /\bpath\b|\bfile\b|\bfilename\b/i, namePattern: /\bwrite\b|\bcreate\b|\bsave\b|\bupdate\b|\bedit\b/i, type: 'fs:write', risk: 'medium' },
  { paramPattern: /\bquery\b|\bsql\b|\bstatement\b/i, namePattern: /\bquery\b|\bsql\b|\bdb\b|\bdatabase\b/i, type: 'db:query', risk: 'medium' },
  { paramPattern: null, namePattern: /\bemail\b|\bmessage\b|\bsend\b|\bnotif/i, type: 'msg:send', risk: 'medium' },
  { paramPattern: null, namePattern: /\bdelete\b|\bremove\b|\bdrop\b|\bpurge\b|\bdestroy\b/i, type: 'data:delete', risk: 'high' },
]

const RISKY: { pattern: RegExp; message: string; severity: RiskLevel }[] = [
  { pattern: /rm\s+-rf\b/g, message: 'Destructive file deletion (rm -rf)', severity: 'critical' },
  { pattern: /curl\s.*\|\s*bash/g, message: 'Remote code execution (curl | bash)', severity: 'critical' },
  { pattern: /\beval\s*\(/g, message: 'Dynamic code execution (eval)', severity: 'critical' },
  { pattern: /\bnew\s+Function\s*\(/g, message: 'Dynamic function creation', severity: 'high' },
  { pattern: /\bchild_process\b|\bspawn\b|\bexecSync\b/g, message: 'Shell execution via child_process', severity: 'high' },
  { pattern: /\bsudo\b/g, message: 'Sudo/elevated privilege usage', severity: 'critical' },
  { pattern: /\b(password|secret|token|api[_-]?key|private[_-]?key)\b/gi, message: 'Credential/secret pattern detected', severity: 'medium' },
]

const SENS_ENV = /key|token|secret|password|credential|auth/i

function detectTransport(t: string): Transport {
  if (/\bsse\b|server.sent.event/i.test(t)) return 'sse'
  if (/\bhttp\b.*transport|streamablehttp|\/mcp\b/i.test(t) && !/\bstdio\b/i.test(t)) return 'http'
  return 'stdio'
}

interface PJ { name?: string; description?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; engines?: { node?: string } }

function detectRuntime(pj: PJ | null, t: string): string {
  if (pj?.dependencies?.['@modelcontextprotocol/sdk'] || pj?.devDependencies?.['typescript'] || pj?.engines?.node) return 'node'
  if (/pyproject\.toml|requirements\.txt|\bpip\b|\bpython\b/i.test(t)) return 'python'
  if (/\bgo\.mod\b/i.test(t)) return 'go'
  if (/\bCargo\.toml\b/i.test(t)) return 'rust'
  return 'node'
}

function parseTools(text: string): McpTool[] {
  const tools: McpTool[] = []
  for (const m of text.matchAll(/###\s+`?(\w[\w_-]*)`?\s*\n([\s\S]*?)(?=\n###\s|\n##\s|$)/g)) {
    const name = m[1], body = m[2]
    if (/^(installation|setup|configuration|usage|example|prerequisites|requirements|license|contributing)/i.test(name)) continue
    const desc = body.split('\n').find((l: string) => l.trim() && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-'))?.trim() || ''
    const params: McpToolParam[] = []
    for (const r of body.matchAll(/\|\s*`?(\w+)`?\s*\|\s*(\w+)\s*\|\s*([^|]*)\|/g)) params.push({ name: r[1], type: r[2], description: r[3].trim() })
    for (const b of body.matchAll(/-\s+[`*]*(\w+)[`*]*\s*(?:\((\w+)\))?[:\s-]+(.+)/g)) {
      if (!params.find((p: McpToolParam) => p.name === b[1])) params.push({ name: b[1], type: b[2] || 'string', description: b[3].trim() })
    }
    if (params.length > 0 || /tool|function|method|action|command/i.test(body.slice(0, 200))) tools.push({ name, description: desc.slice(0, 300), inputSchema: params })
  }
  if (tools.length === 0) {
    for (const m of text.matchAll(/-\s+\*\*(\w[\w_-]*)\*\*\s*[-:\u2013]\s*(.+)/g)) {
      if (!/install|setup|config|require|license|example|usage/i.test(m[1])) tools.push({ name: m[1], description: m[2].trim().slice(0, 300), inputSchema: [] })
    }
  }
  return tools
}

function detectEnvVars(text: string): string[] {
  const vars = new Set<string>()
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
    const v = m[1]
    if (/^(API|AWS|AZURE|GCP|GITHUB|OPENAI|ANTHROPIC|DATABASE|DB_|REDIS|MONGO|POSTGRES|MYSQL|SECRET|TOKEN|KEY|PASSWORD|AUTH|SMTP|SLACK|DISCORD|STRIPE)/.test(v) ||
        /_KEY$|_TOKEN$|_SECRET$|_PASSWORD$|_URL$|_URI$|_HOST$|_PORT$/.test(v)) vars.add(v)
  }
  return [...vars]
}

function toolPerms(tool: McpTool): Permission[] {
  const perms: Permission[] = [], seen = new Set<string>()
  for (const r of TOOL_RULES) {
    let hit = false
    if (r.namePattern?.test(tool.name)) hit = true
    if (r.paramPattern && tool.inputSchema?.some((p: McpToolParam) => r.paramPattern!.test(p.name))) hit = true
    if (hit && !seen.has(r.type)) { seen.add(r.type); perms.push({ type: r.type, risk: r.risk, detected_by: 'mcp-static', evidence: [tool.name] }) }
  }
  return perms
}

export async function analyzeMcp(input: { npmPackage?: string; githubUrl?: string; readme?: string; name?: string; packageJson?: PJ }): Promise<AnalysisResult> {
  let text = input.readme || '', pj: PJ | null = input.packageJson || null, pkgName = input.name || input.npmPackage || '', desc = '', deps = 0

  if (input.npmPackage) {
    try {
      const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(input.npmPackage)}`)
      if (r.ok) {
        const d = await r.json() as Record<string, unknown>
        const lat = (d['dist-tags'] as Record<string, string>)?.latest
        const vers = d.versions as Record<string, PJ> | undefined
        const lv = lat && vers ? vers[lat] : null
        pkgName = (d.name as string) || input.npmPackage; desc = (d.description as string) || ''; text = (d.readme as string) || text
        if (lv) { pj = lv; deps = Object.keys(lv.dependencies || {}).length + Object.keys(lv.devDependencies || {}).length }
      }
    } catch { /* continue */ }
  }

  if (input.githubUrl) {
    const m = input.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (m) {
      const owner = m[1], rn = m[2].replace(/\.git$/, '')
      try {
        const rr = await fetch(`https://raw.githubusercontent.com/${owner}/${rn}/main/README.md`, { headers: { 'User-Agent': 'Vet/1.0' } })
        if (rr.ok) text = await rr.text()
        const pr = await fetch(`https://raw.githubusercontent.com/${owner}/${rn}/main/package.json`, { headers: { 'User-Agent': 'Vet/1.0' } })
        if (pr.ok) { pj = await pr.json() as PJ; pkgName = pj.name || pkgName || rn; desc = desc || pj.description || ''; deps = Object.keys(pj.dependencies || {}).length + Object.keys(pj.devDependencies || {}).length }
        if (!pkgName) pkgName = rn
      } catch { /* continue */ }
    }
  }

  if (!pkgName) pkgName = input.name || 'unknown-mcp'
  const transport = detectTransport(text), runtime = detectRuntime(pj, text), tools = parseTools(text), envVars = detectEnvVars(text)

  const allPerms: Permission[] = [], seenP = new Set<string>()
  for (const tool of tools) {
    tool.permissions = toolPerms(tool)
    for (const p of tool.permissions) { if (!seenP.has(p.type)) { seenP.add(p.type); allPerms.push(p) } }
  }

  const issues: SecurityIssue[] = []
  for (const r of RISKY) { const m = text.match(r.pattern); if (m) issues.push({ severity: r.severity, message: r.message, count: m.length, evidence: m.slice(0, 3) }) }
  const sensEnv = envVars.filter(v => SENS_ENV.test(v))
  if (sensEnv.length > 0) issues.push({ severity: 'medium', message: `Requires sensitive env vars: ${sensEnv.join(', ')}`, count: sensEnv.length, evidence: sensEnv })

  let ts = 75
  for (const p of allPerms) { if (p.risk === 'critical') ts -= 15; else if (p.risk === 'high') ts -= 10; else if (p.risk === 'medium') ts -= 5 }
  for (const i of issues) { if (i.severity === 'critical') ts -= 20; else if (i.severity === 'high') ts -= 10; else if (i.severity === 'medium') ts -= 3 }
  if (tools.length > 0) ts += 5; if (text.length > 500) ts += 3
  ts = Math.max(0, Math.min(100, ts))

  let badge: BadgeType = 'unverified'
  if (issues.some(i => i.severity === 'critical')) badge = 'flagged'
  else if (ts >= 75) badge = 'certified'
  else if (ts >= 50) badge = 'reviewed'

  return {
    name: pkgName, description: desc || text.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim()?.slice(0, 300) || '',
    type: 'mcp', transport, runtime, tools, permissions: allPerms, issues, trustScore: ts, badge,
    codeQuality: { hasTests: /\btest\b|\bspec\b/i.test(text), hasDocs: text.length > 300, hasLicense: /\blicense\b|\bMIT\b|\bApache\b/i.test(text), hasPermissionDeclaration: /\bpermission\b|\baccess\b/i.test(text), linesOfCode: text.split('\n').length, dependencyCount: deps },
    riskFactors: issues.filter(i => i.severity === 'critical' || i.severity === 'high').map(i => i.message), envVars,
  }
}
