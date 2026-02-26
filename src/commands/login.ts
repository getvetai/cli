import { readAuthConfig, writeAuthConfig, deleteAuthConfig } from '../utils/config.js'

const API_BASE = 'https://getvet.ai'

export async function loginCommand(options: { apiKey?: string }) {
  if (options.apiKey) {
    // Direct API key flow
    writeAuthConfig({ apiKey: options.apiKey, email: 'unknown', plan: 'unknown' })
    console.log('✅ API key saved. Run `vet whoami` to verify.')
    return
  }

  // Browser auth flow
  try {
    const res = await fetch(`${API_BASE}/api/cli/auth/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to initiate auth')
    const { code, authUrl } = await res.json() as { code: string; authUrl: string }

    console.log('Opening browser...')
    try {
      const open = (await import('open')).default
      await open(authUrl)
    } catch {
      console.log(`Open this URL: ${authUrl}`)
    }

    console.log(`\nWaiting for authorization... (code: ${code})`)

    // Poll
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0
    while (true) {
      await new Promise(r => setTimeout(r, 2000))
      process.stdout.write(`\r${spinner[i++ % spinner.length]} Waiting for browser authorization...`)

      const pollRes = await fetch(`${API_BASE}/api/cli/auth/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await pollRes.json() as any

      if (data.status === 'authorized') {
        process.stdout.write('\r')
        writeAuthConfig({ apiKey: data.apiKey, email: data.email, plan: data.plan })
        console.log(`✅ Logged in as ${data.email} (${data.plan} plan)`)
        return
      }
      if (data.status === 'expired') {
        process.stdout.write('\r')
        console.log('❌ Authorization expired. Please try again.')
        process.exit(1)
      }
    }
  } catch (e: any) {
    console.error('Login failed:', e.message)
    process.exit(1)
  }
}

export async function logoutCommand() {
  deleteAuthConfig()
  console.log('Logged out')
}

export async function whoamiCommand() {
  const config = readAuthConfig()
  if (config) {
    console.log(`${config.email} (${config.plan} plan)`)
  } else {
    console.log('Not logged in. Run `vet login`')
  }
}
