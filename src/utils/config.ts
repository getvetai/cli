import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ─── Auth config (~/.vet/config.json) ───
export interface VetAuthConfig {
  apiKey: string
  email: string
  plan: string
}

const AUTH_CONFIG_DIR = join(homedir(), '.vet')
const AUTH_CONFIG_PATH = join(AUTH_CONFIG_DIR, 'config.json')

export function readAuthConfig(): VetAuthConfig | null {
  try { return JSON.parse(readFileSync(AUTH_CONFIG_PATH, 'utf-8')) } catch { return null }
}

export function writeAuthConfig(config: VetAuthConfig) {
  mkdirSync(AUTH_CONFIG_DIR, { recursive: true })
  writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
}

export function deleteAuthConfig() {
  try { unlinkSync(AUTH_CONFIG_PATH) } catch {}
}

export interface DiscoveredTool {
  name: string
  source: string
  type: 'mcp-config' | 'mcp-package' | 'skill' | 'openclaw-skill'
  target?: string
  content?: string
}

export function discoverTools(projectPath: string): { tools: DiscoveredTool[]; sources: { source: string; count: number }[] } {
  const tools: DiscoveredTool[] = [], sc = new Map<string, number>()
  const add = (s: string, n: number) => { if (n > 0) sc.set(s, (sc.get(s) || 0) + n) }

  const pkgPath = join(projectPath, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }
      let c = 0
      for (const d of Object.keys(all)) {
        if (d.includes('mcp') || d.startsWith('@modelcontextprotocol/')) {
          tools.push({ name: d, source: 'package.json', type: 'mcp-package', target: d }); c++
        }
      }
      add('package.json', c)
    } catch { /* skip */ }
  }

  // Standard MCP config files (mcpServers or servers key at top level)
  const mcpPaths = [
    join(projectPath, '.cursor', 'mcp.json'),
    join(projectPath, 'mcp.json'),
    join(homedir(), '.config', 'claude', 'claude_desktop_config.json'),
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    join(homedir(), '.windsurf', 'mcp.json'),
    join(homedir(), '.config', 'windsurf', 'mcp.json'),
    join(homedir(), '.config', 'cline', 'mcp_settings.json'),
  ]
  for (const cp of mcpPaths) {
    if (!existsSync(cp)) continue
    try {
      const cfg = JSON.parse(readFileSync(cp, 'utf-8'))
      const svrs: Record<string, Record<string, unknown>> = cfg.mcpServers || cfg.servers || {}
      let c = 0
      for (const [n, v] of Object.entries(svrs)) {
        const target = (v.command === 'npx' ? (v.args as string[])?.[0] : undefined) || n
        tools.push({ name: n, source: cp.replace(homedir(), '~'), type: 'mcp-config', target }); c++
      }
      add(cp.replace(homedir(), '~'), c)
    } catch { /* skip */ }
  }

  // VS Code settings.json — look for mcp.servers key
  const vscodePath = join(homedir(), '.config', 'Code', 'User', 'settings.json')
  if (existsSync(vscodePath)) {
    try {
      const cfg = JSON.parse(readFileSync(vscodePath, 'utf-8'))
      const svrs: Record<string, Record<string, unknown>> = cfg['mcp.servers'] || cfg?.mcp?.servers || {}
      let c = 0
      for (const [n, v] of Object.entries(svrs)) {
        const target = (v.command === 'npx' ? (v.args as string[])?.[0] : undefined) || n
        tools.push({ name: n, source: vscodePath.replace(homedir(), '~'), type: 'mcp-config', target }); c++
      }
      add(vscodePath.replace(homedir(), '~'), c)
    } catch { /* skip */ }
  }

  // Zed settings.json — look for mcp key
  const zedPath = join(homedir(), '.config', 'zed', 'settings.json')
  if (existsSync(zedPath)) {
    try {
      const cfg = JSON.parse(readFileSync(zedPath, 'utf-8'))
      const svrs: Record<string, Record<string, unknown>> = cfg?.mcp?.servers || cfg?.mcp || {}
      let c = 0
      for (const [n, v] of Object.entries(svrs)) {
        if (typeof v !== 'object' || v === null) continue
        const target = ((v as any).command === 'npx' ? ((v as any).args as string[])?.[0] : undefined) || n
        tools.push({ name: n, source: zedPath.replace(homedir(), '~'), type: 'mcp-config', target }); c++
      }
      add(zedPath.replace(homedir(), '~'), c)
    } catch { /* skip */ }
  }

  // Continue config.json — look for mcpServers key
  const continuePath = join(homedir(), '.continue', 'config.json')
  if (existsSync(continuePath)) {
    try {
      const cfg = JSON.parse(readFileSync(continuePath, 'utf-8'))
      const svrs: Record<string, Record<string, unknown>> = cfg.mcpServers || {}
      let c = 0
      for (const [n, v] of Object.entries(svrs)) {
        const target = (v.command === 'npx' ? (v.args as string[])?.[0] : undefined) || n
        tools.push({ name: n, source: continuePath.replace(homedir(), '~'), type: 'mcp-config', target }); c++
      }
      add(continuePath.replace(homedir(), '~'), c)
    } catch { /* skip */ }
  }

  for (const op of [join(projectPath, 'openclaw.json'), join(homedir(), '.openclaw', 'openclaw.json')]) {
    if (!existsSync(op)) continue
    try {
      const cfg = JSON.parse(readFileSync(op, 'utf-8'))
      const skills = cfg.skills || cfg.installedSkills || []
      let c = 0
      if (Array.isArray(skills)) {
        for (const s of skills) {
          const n = typeof s === 'string' ? s : (s as Record<string, string>).name
          tools.push({ name: n, source: op.replace(homedir(), '~'), type: 'openclaw-skill', target: n }); c++
        }
      }
      add(op.replace(homedir(), '~'), c)
    } catch { /* skip */ }
  }

  findSkills(projectPath, tools, sc, 0)
  return { tools, sources: [...sc.entries()].map(([source, count]) => ({ source, count })) }
}

function findSkills(dir: string, tools: DiscoveredTool[], sc: Map<string, number>, depth: number): void {
  if (depth > 4) return
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      const fp = join(dir, e.name)
      if (e.isFile() && e.name === 'SKILL.md') {
        const content = readFileSync(fp, 'utf-8')
        const nm = content.match(/^#\s+(.+)$/m)?.[1]?.trim().replace(/[*_`]/g, '') || e.name
        tools.push({ name: nm, source: fp, type: 'skill', target: fp, content })
        sc.set('SKILL.md files', (sc.get('SKILL.md files') || 0) + 1)
      }
      if (e.isDirectory()) findSkills(fp, tools, sc, depth + 1)
    }
  } catch { /* permission denied */ }
}
