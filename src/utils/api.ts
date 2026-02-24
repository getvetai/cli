const API_BASE = 'https://getvet.ai'

export async function lookupTool(slug: string): Promise<any | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/skills/${encodeURIComponent(slug)}`, {
      headers: { 'User-Agent': 'vet-cli/0.3.0' },
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
      headers: { 'User-Agent': 'vet-cli/0.3.0' },
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
      headers: { 'User-Agent': 'vet-cli/0.3.0', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) return await resp.json()
    return null
  } catch { return null }
}
