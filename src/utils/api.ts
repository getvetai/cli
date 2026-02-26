import { readAuthConfig } from './config.js'

const API_BASE = 'https://getvet.ai'

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'vet-cli/0.4.4' }
  const config = readAuthConfig()
  if (config?.apiKey) headers['x-api-key'] = config.apiKey
  return headers
}

export async function lookupTool(slug: string): Promise<any | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/skills/${encodeURIComponent(slug)}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000),
    })
    if (resp.ok) return await resp.json()
    return null
  } catch { return null }
}

export async function searchTools(query: string, options?: { limit?: number; type?: string }): Promise<any[]> {
  try {
    const limit = Math.min(Math.max(Number(options?.limit) || 10, 1), 48)
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    if (options?.type && options.type !== 'all') params.set('type', options.type)
    const resp = await fetch(`${API_BASE}/api/skills/search?${params}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000),
    })
    if (resp.ok) {
      const data = await resp.json()
      return Array.isArray(data) ? data : data.results || data.items || []
    }
    return []
  } catch { return [] }
}

export async function requestDeepScan(slug: string): Promise<any | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/tools/${encodeURIComponent(slug)}/deep-scan`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) return await resp.json()
    return null
  } catch { return null }
}
