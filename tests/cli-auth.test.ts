import { describe, it, expect, vi, afterEach } from 'vitest'
import { readAuthConfig, writeAuthConfig, deleteAuthConfig } from '../src/utils/config.js'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Test auth config file operations with a temp directory
const TEST_DIR = join(tmpdir(), 'vet-cli-test-' + Date.now())

vi.mock('../src/utils/config.js', async () => {
  const { mkdirSync, writeFileSync, readFileSync, unlinkSync } = await import('fs')
  const { join } = await import('path')
  const { tmpdir } = await import('os')
  
  const testDir = join(tmpdir(), 'vet-cli-test-' + Date.now())
  const configPath = join(testDir, 'config.json')
  
  return {
    AUTH_CONFIG_PATH: configPath,
    readAuthConfig: () => {
      try { return JSON.parse(readFileSync(configPath, 'utf-8')) } catch { return null }
    },
    writeAuthConfig: (config: any) => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    },
    deleteAuthConfig: () => {
      try { unlinkSync(configPath) } catch {}
    },
  }
})

describe('CLI Auth - config operations', () => {
  afterEach(() => {
    deleteAuthConfig()
  })

  it('writeAuthConfig + readAuthConfig round-trips correctly', () => {
    const config = { apiKey: 'vet_sk_abc123', email: 'test@test.com', plan: 'free' }
    writeAuthConfig(config)
    const read = readAuthConfig()
    expect(read).toEqual(config)
  })

  it('readAuthConfig returns null when no config exists', () => {
    deleteAuthConfig()
    const read = readAuthConfig()
    expect(read).toBeNull()
  })

  it('deleteAuthConfig removes the config', () => {
    writeAuthConfig({ apiKey: 'vet_sk_abc', email: 'x@x.com', plan: 'free' })
    expect(readAuthConfig()).not.toBeNull()
    deleteAuthConfig()
    expect(readAuthConfig()).toBeNull()
  })

  it('deleteAuthConfig does not throw when no config exists', () => {
    expect(() => deleteAuthConfig()).not.toThrow()
  })
})

describe('CLI Auth - login flow', () => {
  it('initiate returns code and authUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'abc12345', authUrl: 'https://getvet.ai/cli/auth?code=abc12345' }),
    } as Response)

    const res = await fetch('https://getvet.ai/api/cli/auth/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json() as any
    expect(data.code).toBe('abc12345')
    expect(data.authUrl).toContain('/cli/auth?code=')
  })

  it('poll returns pending while waiting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending' }),
    } as Response)

    const res = await fetch('https://getvet.ai/api/cli/auth/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'abc12345' }),
    })
    const data = await res.json() as any
    expect(data.status).toBe('pending')
  })

  it('poll returns authorized with API key after user authorizes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'authorized',
        apiKey: 'vet_sk_generated123',
        email: 'user@example.com',
        plan: 'free',
      }),
    } as Response)

    const res = await fetch('https://getvet.ai/api/cli/auth/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'abc12345' }),
    })
    const data = await res.json() as any
    expect(data.status).toBe('authorized')
    expect(data.apiKey).toMatch(/^vet_sk_/)
    expect(data.email).toBe('user@example.com')
    expect(data.plan).toBe('free')
  })

  it('poll returns expired for invalid/expired codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'expired' }),
    } as Response)

    const res = await fetch('https://getvet.ai/api/cli/auth/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'invalid' }),
    })
    const data = await res.json() as any
    expect(data.status).toBe('expired')
  })

  it('direct --api-key login saves config without browser', () => {
    const key = 'vet_sk_directkey123'
    writeAuthConfig({ apiKey: key, email: 'unknown', plan: 'unknown' })
    const config = readAuthConfig()
    expect(config?.apiKey).toBe(key)
  })
})

describe('CLI Auth - logout', () => {
  it('removes stored credentials', () => {
    writeAuthConfig({ apiKey: 'vet_sk_abc', email: 'x@x.com', plan: 'free' })
    deleteAuthConfig()
    expect(readAuthConfig()).toBeNull()
  })
})

describe('CLI Auth - whoami', () => {
  it('returns user info when logged in', () => {
    const config = { apiKey: 'vet_sk_abc', email: 'user@test.com', plan: 'pro' }
    writeAuthConfig(config)
    const read = readAuthConfig()
    expect(read?.email).toBe('user@test.com')
    expect(read?.plan).toBe('pro')
  })

  it('returns null when not logged in', () => {
    deleteAuthConfig()
    expect(readAuthConfig()).toBeNull()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
