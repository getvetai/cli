import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock config to control auth state
vi.mock('../src/utils/config.js', () => ({
  readAuthConfig: vi.fn(() => null),
  writeAuthConfig: vi.fn(),
  deleteAuthConfig: vi.fn(),
}))

import { readAuthConfig } from '../src/utils/config.js'
import { searchTools, lookupTool, requestDeepScan } from '../src/utils/api.js'

const mockReadAuth = vi.mocked(readAuthConfig)

describe('API - searchTools', () => {
  it('returns results on success', async () => {
    const mockResults = [{ name: 'test-tool', slug: 'test-tool' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    } as Response)

    const results = await searchTools('test', { limit: 3 })
    expect(results).toEqual(mockResults)
    
    const url = (fetch as any).mock.calls[0][0] as string
    expect(url).toContain('limit=3')
  })

  it('throws on 429 rate limit with server message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Monthly unique tool limit reached (100/100 for free plan). Upgrade at https://getvet.ai/pricing' }),
    } as Response)

    await expect(searchTools('test')).rejects.toThrow('Monthly unique tool limit reached')
  })

  it('throws on 403 forbidden with server message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Bulk schema access requires Pro plan' }),
    } as Response)

    await expect(searchTools('test')).rejects.toThrow('Bulk schema access requires Pro plan')
  })

  it('returns empty array on other errors (404, 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response)

    const results = await searchTools('test')
    expect(results).toEqual([])
  })

  it('respects limit parameter bounds (min 1, max 48)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    await searchTools('test', { limit: 0 })
    let url = (fetch as any).mock.calls[0][0] as string
    expect(url).toContain('limit=1')

    await searchTools('test', { limit: 100 })
    url = (fetch as any).mock.calls[1][0] as string
    expect(url).toContain('limit=48')
  })

  it('defaults to limit 10 when not specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await searchTools('test')
    const url = (fetch as any).mock.calls[0][0] as string
    expect(url).toContain('limit=10')
  })
})

describe('API - lookupTool', () => {
  it('returns tool data on success', async () => {
    const tool = { name: 'slack', slug: 'slack', trustScore: 80 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => tool,
    } as Response)

    const result = await lookupTool('slack')
    expect(result).toEqual(tool)
  })

  it('throws on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    } as Response)

    await expect(lookupTool('slack')).rejects.toThrow('Rate limit exceeded')
  })

  it('returns null on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const result = await lookupTool('nonexistent')
    expect(result).toBeNull()
  })
})

describe('API - requestDeepScan', () => {
  it('throws on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Deep scan requires authentication' }),
    } as Response)

    await expect(requestDeepScan('slack')).rejects.toThrow('Deep scan requires authentication')
  })
})

describe('API - authentication headers', () => {
  it('includes x-api-key header when logged in', async () => {
    mockReadAuth.mockReturnValueOnce({ apiKey: 'vet_sk_test123', email: 'test@test.com', plan: 'pro' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await searchTools('test')
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>
    expect(headers['x-api-key']).toBe('vet_sk_test123')
  })

  it('does not include x-api-key when not logged in', async () => {
    mockReadAuth.mockReturnValueOnce(null)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    await searchTools('test')
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>
    expect(headers['x-api-key']).toBeUndefined()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
