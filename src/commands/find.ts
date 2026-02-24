import ora from 'ora'
import { searchTools } from '../utils/api.js'
import { displayFindResults } from '../utils/display.js'
import type { BadgeType } from '../types.js'

export async function findCommand(query: string, options: { json?: boolean; limit?: string; type?: string }): Promise<void> {
  const spinner = ora(`Searching "${query}"...`).start()
  try {
    const items = await searchTools(query, { limit: Number(options.limit) || 10, type: options.type })
    const results = items.map((x: any) => ({
      name: x.name,
      slug: x.slug,
      description: x.description,
      trustScore: x.trustScore ?? x.trust_score,
      badge: x.badge as BadgeType | undefined,
      author: x.author,
      version: x.version,
      installs: x.installs,
    }))

    spinner.stop()
    if (options.json) console.log(JSON.stringify(results, null, 2))
    else displayFindResults(results)
  } catch (err) {
    spinner.fail(`Search failed: ${(err as Error).message}`)
    process.exitCode = 1
  }
}
