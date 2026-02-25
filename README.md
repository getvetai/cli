# @getvetai/cli

Security audit CLI for AI skills and MCP servers. Scan, audit, and discover tools before you install them.

🌐 **Registry:** [getvet.ai](https://getvet.ai) — 23,000+ AI tools verified and scored

## Install

```bash
npm install -g @getvetai/cli
```

Or run without installing:

```bash
npx @getvetai/cli scan .
```

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

## Verification Levels

| Level | Badge | Meaning |
|-------|-------|---------|
| L2 | ✅ Verified | Installs, boots, tools discovered and tested |
| L1 | 🔍 Boots | Installs and boots successfully |
| L0 | ⚠️ Indexed | Cataloged, not yet verified |

## What It Detects

- **Permissions:** shell execution, file I/O, network access, browser control, database queries, crypto operations
- **Security issues:** destructive commands, remote code execution, dynamic eval, credential patterns, elevated privileges
- **MCP-specific:** tool parameter analysis, transport detection (stdio/http/sse), runtime detection
- **Requirements:** environment variables, API keys, Docker dependencies

## API Access

Access verified tool schemas programmatically. Create a free API key at [getvet.ai/dashboard](https://getvet.ai/dashboard) → API Keys.

```bash
# Fetch tool schemas
curl -H "x-api-key: vet_sk_YOUR_KEY" https://getvet.ai/api/v1/tools/TOOL_SLUG/schemas

# Or use Bearer token
curl -H "Authorization: Bearer vet_sk_YOUR_KEY" https://getvet.ai/api/v1/tools/TOOL_SLUG/schemas

# Bulk fetch (multiple tools at once)
curl -X POST \
  -H "x-api-key: vet_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slugs":["tool-1","tool-2"]}' \
  https://getvet.ai/api/v1/tools/schemas/bulk
```

See [getvet.ai/get-started](https://getvet.ai/get-started) for full documentation.

## Links

- 🌐 [getvet.ai](https://getvet.ai) — Browse the registry
- 📦 [npm](https://www.npmjs.com/package/@getvetai/cli) — Package page

## License

MIT
