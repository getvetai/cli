# @getvetai/cli

Security audit CLI for AI skills and MCP servers. Scan, audit, and discover tools before you install them.

🌐 **Registry:** [getvet.ai](https://getvet.ai) — 20,000+ AI tools cataloged and scored

## Install

```bash
npm install -g @getvetai/cli
```

Or run without installing:

```bash
npx @getvetai/cli scan .
```

## What's New in v0.3.0

- **`vet find --limit <n>`** — control how many results to return (default: 10, max: 48)
- **`vet find --type <type>`** — filter by `skill`, `mcp`, or `all`
- **20,000+ tools** in the registry (up from 12K) — now indexing 10 sources including Smithery, mcp.so, MCP Registry, PyPI, npm, GitHub, and more

## Commands

### `vet scan <target>`

Scan a tool for security issues. Checks the [getvet.ai](https://getvet.ai) registry first for instant results.

```bash
# Scan an npm package (checks registry first)
vet scan @modelcontextprotocol/server-filesystem

# Local analysis only (skip registry)
vet scan @modelcontextprotocol/server-filesystem --offline

# Request a deep scan from registry
vet scan @modelcontextprotocol/server-filesystem --deep

# Scan a local project
vet scan ./my-mcp-server

# Scan a GitHub repo
vet scan https://github.com/modelcontextprotocol/servers

# JSON output
vet scan ./SKILL.md --json
```

### `vet audit [path]`

Audit all AI tools in a project. Auto-discovers MCP configurations from:

**Claude Desktop** · **Cursor** · **VS Code** · **Windsurf** · **Cline** · **Zed** · **Continue** · **OpenClaw**

```bash
# Audit current directory
vet audit

# Audit a specific project
vet audit ./my-project

# Strict mode — exit 1 if any tool is unverified/flagged
vet audit --strict

# JSON output
vet audit --json
```

### `vet find <query>`

Search the getvet.ai registry for tools by description.

```bash
# Search for tools
vet find "web scraping"
vet find "database access"

# Limit results
vet find "browser automation" --limit 20

# Filter by type
vet find "file management" --type mcp

# JSON output
vet find "weather" --json
```

### `vet install <package>`

Install a package with a pre-install security audit.

```bash
# Audit + install
vet install @modelcontextprotocol/server-github

# Install globally
vet install -g some-mcp-server
```

## Trust Scores

| Score | Badge | Meaning |
|-------|-------|---------|
| 75+ | ✅ Certified | No critical issues, good practices |
| 50–74 | 🔍 Reviewed | Some concerns, use with caution |
| 25–49 | ⚠️ Unverified | Not yet reviewed or limited info |
| 0–24 | 🚫 Flagged | Critical security issues found |

## What It Detects

- **Permissions:** shell execution, file I/O, network access, browser control, database queries, crypto operations
- **Security issues:** destructive commands, remote code execution, dynamic eval, credential patterns, elevated privileges
- **MCP-specific:** tool parameter analysis, transport detection (stdio/http/sse), runtime detection

## Links

- 🌐 [getvet.ai](https://getvet.ai) — Browse the registry
- 📦 [npm](https://www.npmjs.com/package/@getvetai/cli) — Package page

## License

MIT
