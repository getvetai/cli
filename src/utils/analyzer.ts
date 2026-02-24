import type { Permission, SecurityIssue, CodeQuality, BadgeType, AnalysisResult, RiskLevel } from '../types.js'

const PERM_PATTERNS: { pattern: RegExp; type: string; risk: RiskLevel }[] = [
  { pattern: /\bexec\b|\bshell\b|\bcommand\b|\bspawn\b|\bchild_process\b/gi, type: 'exec:shell', risk: 'critical' },
  { pattern: /\bread\b.*file|\bfs[:\.]read|\bReadFile|\bfile.*read/gi, type: 'fs:read', risk: 'low' },
  { pattern: /\bwrite\b.*file|\bfs[:\.]write|\bWriteFile|\bfile.*write|\bcreate.*file/gi, type: 'fs:write', risk: 'medium' },
  { pattern: /\bweb_fetch\b|\bfetch\b|\bhttp[s]?:\/\/|\baxios\b|\brequest\b/gi, type: 'net:outbound', risk: 'medium' },
  { pattern: /\bbrowser\b|\bpuppeteer\b|\bplaywright\b|\bselenium\b/gi, type: 'browser:control', risk: 'high' },
  { pattern: /\bmessage\b.*send|\bsend.*message|\bemail\b|\bslack\b|\bdiscord\b|\btelegram\b/gi, type: 'msg:send', risk: 'high' },
  { pattern: /\bprocess\b|\bbackground\b|\bdaemon\b/gi, type: 'exec:process', risk: 'medium' },
  { pattern: /\bweb_search\b|\bsearch.*web/gi, type: 'net:search', risk: 'low' },
  { pattern: /\bcrypto\b|\bsign\b|\bencrypt\b|\bdecrypt\b/gi, type: 'crypto:sign', risk: 'medium' },
  { pattern: /\bimage\b.*analy|\bvision\b|\bocr\b/gi, type: 'media:analyze', risk: 'low' },
  { pattern: /\btts\b|\btext.to.speech\b|\bspeech\b/gi, type: 'media:tts', risk: 'low' },
  { pattern: /\bcanvas\b|\bpresent\b.*ui/gi, type: 'ui:canvas', risk: 'low' },
  { pattern: /\bnodes?\b.*camera|\bcamera\b.*snap/gi, type: 'device:camera', risk: 'high' },
  { pattern: /\bscreen\b.*record|\bscreenshot\b/gi, type: 'device:screen', risk: 'medium' },
  { pattern: /\blocation\b|\bgps\b|\bgeolocat/gi, type: 'device:location', risk: 'high' },
]

const RISKY_PATTERNS: { pattern: RegExp; message: string; severity: RiskLevel }[] = [
  { pattern: /rm\s+-rf\b/g, message: 'Destructive file deletion (rm -rf)', severity: 'critical' },
  { pattern: /curl\s.*\|\s*bash/g, message: 'Remote code execution (curl | bash)', severity: 'critical' },
  { pattern: /\beval\s*\(/g, message: 'Dynamic code execution (eval)', severity: 'critical' },
  { pattern: /\bnew\s+Function\s*\(/g, message: 'Dynamic function creation', severity: 'high' },
  { pattern: /\b(password|secret|token|api[_-]?key|private[_-]?key|mnemonic)\b/gi, message: 'Credential/secret pattern detected', severity: 'high' },
  { pattern: /\bchmod\s+[0-7]*7[0-7]*\b/g, message: 'Permissive file permissions', severity: 'high' },
  { pattern: /\bsudo\b/g, message: 'Sudo/elevated privilege usage', severity: 'critical' },
  { pattern: /\bssh\b.*connect|\bssh\s+-/g, message: 'SSH connection', severity: 'high' },
  { pattern: /\bcrontab\b|\bsystemctl\b/g, message: 'System service manipulation', severity: 'high' },
]

export function parseSkillName(content: string, fallback: string = 'unknown'): string {
  const h = content.match(/^#\s+(.+)$/m)
  if (h) { const n = h[1].trim().replace(/[*_`]/g, '').trim(); if (n.length > 0 && n.length < 100) return n }
  if (fallback !== 'unknown') return fallback.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return fallback
}

export function analyzeSkill(content: string, name: string = 'unknown'): AnalysisResult {
  const parsedName = parseSkillName(content, name)
  const permissions: Permission[] = [], issues: SecurityIssue[] = [], seen = new Set<string>()

  for (const p of PERM_PATTERNS) {
    const m = content.match(p.pattern)
    if (m && !seen.has(p.type)) { seen.add(p.type); permissions.push({ type: p.type, risk: p.risk, detected_by: 'static', evidence: m.slice(0, 3).map(x => x.trim()) }) }
  }
  for (const r of RISKY_PATTERNS) {
    const m = content.match(r.pattern)
    if (m) issues.push({ severity: r.severity, message: r.message, count: m.length, evidence: m.slice(0, 3).map(x => x.trim()) })
  }

  let ts = 80
  for (const p of permissions) { if (p.risk === 'critical') ts -= 15; else if (p.risk === 'high') ts -= 10; else if (p.risk === 'medium') ts -= 5 }
  for (const i of issues) { if (i.severity === 'critical') ts -= 20; else if (i.severity === 'high') ts -= 10; else if (i.severity === 'medium') ts -= 5 }

  const cq: CodeQuality = {
    hasTests: /\btest\b|\bspec\b|\bjest\b/i.test(content), hasDocs: /\b(readme|documentation|usage|example)\b/i.test(content),
    hasLicense: /\blicense\b|\bMIT\b|\bApache\b/i.test(content), hasPermissionDeclaration: /\bpermission\b|\baccess\b|\brequire\b/i.test(content),
    linesOfCode: content.split('\n').length,
  }
  if (cq.hasTests) ts += 5; if (cq.hasDocs) ts += 3; if (cq.hasLicense) ts += 2; if (cq.hasPermissionDeclaration) ts += 5
  ts = Math.max(0, Math.min(100, ts))

  let badge: BadgeType = 'unverified'
  if (issues.some(i => i.severity === 'critical')) badge = 'flagged'
  else if (ts >= 80) badge = 'certified'
  else if (ts >= 50) badge = 'reviewed'

  return { name: parsedName, type: 'skill', permissions, issues, trustScore: ts, badge, codeQuality: cq, riskFactors: issues.filter(i => i.severity === 'critical' || i.severity === 'high').map(i => i.message) }
}
