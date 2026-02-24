import chalk from 'chalk'
import type { AnalysisResult, BadgeType, RiskLevel } from '../types.js'

const BADGE: Record<BadgeType, { emoji: string; label: string; color: (s: string) => string }> = {
  certified: { emoji: '✅', label: 'Certified', color: chalk.green },
  reviewed: { emoji: '🔍', label: 'Reviewed', color: chalk.blue },
  unverified: { emoji: '⚠️', label: 'Unverified', color: chalk.yellow },
  flagged: { emoji: '🚫', label: 'Flagged', color: chalk.red },
}

const RC: Record<RiskLevel, (s: string) => string> = { low: chalk.green, medium: chalk.yellow, high: chalk.red, critical: chalk.redBright.bold }

function bar(score: number): string {
  const f = Math.round(score / 10), e = 10 - f
  const c = score >= 75 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red
  return c('█'.repeat(f)) + chalk.gray('░'.repeat(e)) + ' ' + c(`${score}/100`)
}

function dot(risk: RiskLevel): string {
  return RC[risk](`⬤ ${risk.charAt(0).toUpperCase() + risk.slice(1)}`)
}

function overallRisk(r: AnalysisResult): RiskLevel {
  if (r.badge === 'flagged') return 'critical'
  if (r.trustScore < 50) return 'high'
  if (r.trustScore < 75) return 'medium'
  return 'low'
}

export function displayScanReport(r: AnalysisResult, registrySlug?: string): void {
  const b = BADGE[r.badge], rk = overallRisk(r)
  console.log()
  console.log(chalk.bold('  🔍 Vet Security Report'))
  console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
  console.log(`  ${chalk.gray('Name:')}        ${chalk.bold(r.name)}`)
  if (r.description) console.log(`  ${chalk.gray('Description:')} ${r.description.slice(0, 80)}`)
  if (r.type === 'mcp') {
    console.log(`  ${chalk.gray('Type:')}        MCP Server`)
    if (r.transport) console.log(`  ${chalk.gray('Transport:')}   ${r.transport}`)
    if (r.runtime) console.log(`  ${chalk.gray('Runtime:')}     ${r.runtime}`)
  } else console.log(`  ${chalk.gray('Type:')}        AI Skill`)
  console.log()
  console.log(`  ${chalk.gray('Trust Score:')} ${bar(r.trustScore)}`)
  console.log(`  ${chalk.gray('Badge:')}       ${b.emoji} ${b.color(b.label)}`)
  console.log(`  ${chalk.gray('Risk:')}        ${dot(rk)}`)

  if (r.permissions.length > 0) {
    console.log()
    console.log(chalk.bold('  📋 Permissions'))
    console.log(chalk.gray(`  ${'Permission'.padEnd(25)} ${'Risk'.padEnd(12)} Evidence`))
    console.log(chalk.gray(`  ${'─'.repeat(25)} ${'─'.repeat(12)} ${'─'.repeat(30)}`))
    for (const p of r.permissions) console.log(`  ${p.type.padEnd(25)} ${RC[p.risk](p.risk.padEnd(12))} ${chalk.gray(p.evidence?.slice(0, 2).join(', ') || '')}`)
  }

  if (r.issues.length > 0) {
    console.log()
    console.log(chalk.bold('  ⚠️  Issues'))
    for (const i of r.issues) {
      const icon = i.severity === 'critical' ? '🔴' : i.severity === 'high' ? '🟠' : i.severity === 'medium' ? '🟡' : '🔵'
      const cf = RC[i.severity as RiskLevel]
      console.log(`  ${icon} ${cf ? cf(i.message) : i.message}`)
    }
  }

  if (r.tools && r.tools.length > 0) {
    console.log()
    console.log(chalk.bold(`  🔧 Tools (${r.tools.length})`))
    for (const t of r.tools.slice(0, 15)) {
      console.log(`  ${chalk.cyan(t.name.padEnd(25))} ${chalk.gray(t.description?.slice(0, 40) || '')}`)
      const ps = t.inputSchema?.map(p => p.name).join(', ')
      if (ps) console.log(`  ${' '.repeat(25)} ${chalk.gray(`params: ${ps}`)}`)
    }
    if (r.tools.length > 15) console.log(chalk.gray(`  ... and ${r.tools.length - 15} more`))
  }

  if (r.envVars && r.envVars.length > 0) {
    console.log()
    console.log(chalk.bold('  🔑 Environment Variables'))
    for (const v of r.envVars) console.log(`  ${chalk.yellow(v)}`)
  }

  if (r.overview) {
    console.log()
    console.log(chalk.bold('  📝 Overview'))
    for (const l of r.overview.split('\n')) console.log(`  ${chalk.gray(l)}`)
  }

  if (registrySlug) {
    console.log()
    console.log(`  ${chalk.gray('View full report:')} ${chalk.cyan(`https://getvet.ai/catalog/${registrySlug}`)}`)
  }

  console.log()
  console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
}

export function displayAuditReport(results: AnalysisResult[], sources: { source: string; count: number }[]): void {
  console.log()
  console.log(chalk.bold('  🔍 Vet Audit Report'))
  console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
  for (const s of sources) console.log(`  📦 Found ${s.count} tool${s.count !== 1 ? 's' : ''} in ${s.source}`)
  console.log()
  const W = 35
  console.log(chalk.gray(`  ${'Tool'.padEnd(W)} ${'Score'.padEnd(7)} ${'Badge'.padEnd(16)} Risk`))
  console.log(chalk.gray(`  ${'─'.repeat(W)} ${'─'.repeat(7)} ${'─'.repeat(16)} ${'─'.repeat(12)}`))
  for (const r of results) {
    const b = BADGE[r.badge], rk = overallRisk(r)
    const nm = r.name.length > W - 1 ? r.name.slice(0, W - 4) + '...' : r.name
    const sc = r.trustScore >= 75 ? chalk.green : r.trustScore >= 50 ? chalk.yellow : chalk.red
    console.log(`  ${nm.padEnd(W)} ${sc(String(r.trustScore).padEnd(7))} ${b.emoji} ${b.color(b.label.padEnd(13))} ${dot(rk)}`)
  }
  console.log()
  console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  const c = { certified: 0, reviewed: 0, unverified: 0, flagged: 0 }
  for (const r of results) c[r.badge]++
  console.log(`  Summary: ${results.length} tools audited | ${c.certified} certified | ${c.reviewed} reviewed | ${c.unverified} unverified | ${c.flagged} flagged`)
  if (c.flagged > 0) console.log(chalk.red.bold(`  ⚠️  ${c.flagged} tool${c.flagged > 1 ? 's' : ''} requires attention`))
  console.log()
}

export function displayFindResults(results: Array<{ name: string; slug?: string; description?: string; trustScore?: number; badge?: BadgeType; author?: string; version?: string; installs?: number }>): void {
  if (!results.length) { console.log(chalk.yellow('\n  No results found.\n')); return }
  console.log()
  console.log(chalk.bold(`  🔎 Search Results (${results.length})`))
  console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  for (const r of results) {
    const b = r.badge ? BADGE[r.badge] : BADGE.unverified
    console.log()
    console.log(`  ${b.emoji} ${chalk.bold(r.name)}${r.version ? chalk.gray(` v${r.version}`) : ''}${r.author ? chalk.gray(` by ${r.author}`) : ''}`)
    if (r.description) console.log(`    ${chalk.gray(r.description.slice(0, 80))}`)
    console.log(`    Score: ${r.trustScore != null ? bar(r.trustScore) : chalk.gray('N/A')}  Badge: ${b.emoji} ${b.color(b.label)}`)
    if (r.installs != null) console.log(`    ${chalk.gray(`${r.installs.toLocaleString()} installs`)}`)
    if (r.slug) console.log(`    ${chalk.cyan(`https://getvet.ai/catalog/${r.slug}`)}`)
  }
  console.log()
}
