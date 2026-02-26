#!/usr/bin/env node

import { Command } from 'commander'
import { scanCommand } from './commands/scan.js'
import { auditCommand } from './commands/audit.js'
import { findCommand } from './commands/find.js'
import { installCommand } from './commands/install.js'

const program = new Command()

program
  .name('vet')
  .description('Security audit CLI for AI skills & MCP servers')
  .version('0.4.4')

program
  .command('scan')
  .description('Scan a single tool for security issues')
  .argument('<target>', 'URL, npm package, file path, or GitHub repo')
  .option('--json', 'Output JSON instead of formatted report')
  .option('--overview', 'Include AI-generated overview')
  .option('--offline', 'Skip registry lookup')
  .option('--deep', 'Request deep scan from registry')
  .action(scanCommand)

program
  .command('audit')
  .description('Audit all AI tools in a project')
  .argument('[path]', 'Project path (defaults to current directory)')
  .option('--json', 'Output JSON')
  .option('--strict', 'Exit code 1 if any tool is unverified or flagged')
  .option('--fix', 'Suggest safer alternatives for flagged tools')
  .action(auditCommand)

program
  .command('find')
  .description('Search for tools by description')
  .argument('<query>', 'Natural language search query')
  .option('--limit <n>', 'Max results to return (default: 10, max: 48)', '10')
  .option('--type <type>', 'Filter by type: skill, mcp, or all (default: all)')
  .option('--json', 'Output JSON')
  .action(findCommand)

program
  .command('install')
  .description('Install a package with pre-install security audit')
  .argument('<package>', 'npm package name')
  .option('--json', 'Output JSON')
  .option('-g, --global', 'Install globally')
  .option('--skill', 'Install as OpenClaw skill via clawhub')
  .action(installCommand)

program.parse()
