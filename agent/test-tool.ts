import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { executeTool } from './tools/index.ts'

// Examples: npm run test:tool -- search_events '{"query":"chess events San Francisco"}'
//           npm run test:tool -- save_plan '{"stops":[]}'
try {
  const envPath = fileURLToPath(new URL('.env', import.meta.url))
  if (existsSync(envPath)) loadEnvFile(envPath)

  const [name, input] = process.argv.slice(2)
  if (!name || !input) throw new Error('Usage: npm run test:tool -- <tool_name> \'{"query":"your keywords"}\'')
  const result = await executeTool(name, JSON.parse(input))
  console.log(result.content_blocks[0].text)
  if (result.outcome === 'failed') process.exitCode = 1
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
