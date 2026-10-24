import { bearerToken, createOmnaraClient, sdk } from '@omnara/sdk'
import { readFile } from 'node:fs/promises'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { runToolWorker } from './tool-worker.ts'

loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)))

if (
  !process.env.OMNARA_TOKEN?.trim() ||
  process.env.OMNARA_TOKEN.trim() === 'replace_with_your_omnara_api_token'
) {
  console.error('Replace the OMNARA_TOKEN placeholder in .env with your Omnara API token.')
  process.exit(1)
}

const source = await readFile(new URL('agent.yaml', import.meta.url), 'utf8')
if (!source.trim()) throw new Error('Add your agent configuration to agent.yaml before launching.')

const user = await readFile(new URL('user.md', import.meta.url), 'utf8')
if (!user.trim()) throw new Error('Add an example user to user.md before launching.')

const task = process.argv.slice(2).join(' ').trim() || 'Plan a nearby outing for this user in the supplied time window.'
const message = `${task}\n\nUser profile and outing details:\n${user}`
const client = createOmnaraClient({
  baseUrl: 'https://api.omnara.com/v1',
  auth: bearerToken(process.env.OMNARA_TOKEN),
})
const project = {
  orgID: 'org_vc7l6n4ix2hhbny7x6xvbfey5e',
  projectID: 'proj_agqw7dscfn7kld6dcv2re2dnxe',
}

const result = await sdk.createAgent({
  client,
  path: project,
  body: {
    config_source: { source, source_format: 'yaml' },
    name: 'Wondr planner',
    message,
  },
})

const path = { ...project, agentID: result.data.agent.id }
console.log('Agent created. Open this chat to follow the run:')
console.log(`https://app.omnara.com/projects/${path.projectID}/agents/${path.agentID}/chat`)
console.log('Running the local tool worker. Finished plans are saved in agent/output/.')

try {
  await runToolWorker({
    async listReadyCalls(cursor) {
      const response = await sdk.listToolCalls({
        client, path, signal: AbortSignal.timeout(30_000),
        query: { type: 'custom', state: 'ready', limit: 100, ...(cursor ? { cursor } : {}) },
      })
      return response.data
    },
    async submitResult(toolCallID, body) {
      await sdk.submitToolCallResult({
        client, path: { ...path, toolCallID }, body, signal: AbortSignal.timeout(30_000),
      })
    },
    async getActivity() {
      const response = await sdk.getAgent({ client, path, signal: AbortSignal.timeout(30_000) })
      return response.data.agent.activity?.state ?? 'unknown'
    },
  })

  // The worker finishes on idle, not on save_plan: the model still needs to
  // receive that tool result and complete its final response.
  let cursor = 0
  let reply = ''
  let stopReason = ''
  do {
    const response = await sdk.listEvents({
      client, path, query: { after_sequence: cursor, limit: 100 }, signal: AbortSignal.timeout(30_000),
    })
    for (const event of response.data.data) {
      if (event.event_kind === 'model_output') {
        stopReason = event.stop_reason
        reply = event.content_blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
      }
    }
    if (!response.data.has_more) break
    cursor = response.data.next_after_sequence
  } while (true)
  if (stopReason !== 'end_turn') throw new Error(`Agent did not complete normally (${stopReason || 'no model output'}). Inspect its chat.`)
  console.log(`\nAgent reply:\n${reply || '(No text reply; inspect the chat.)'}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
