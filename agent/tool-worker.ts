import { setTimeout as sleep } from 'node:timers/promises'
import { executeTool, type ToolResult } from './tools/index.ts'

type PendingCall = { id: string; name: string; input: unknown }

export type ToolWorkerApi = {
  listReadyCalls: (cursor?: string) => Promise<{ data: PendingCall[]; next_cursor: string | null }>
  submitResult: (callID: string, result: ToolResult) => Promise<void>
  getActivity: () => Promise<string>
}

// A small polling worker for the local demo. Production can trigger the same
// executeTool dispatcher from Omnara's tool_call_update webhook instead.
export async function runToolWorker(
  api: ToolWorkerApi,
  options: { pollMs?: number; timeoutMs?: number; log?: (message: string) => void } = {},
): Promise<void> {
  const { pollMs = 3000, timeoutMs = 300_000, log = console.log } = options
  const deadline = Date.now() + timeoutMs
  const submitted = new Set<string>()

  while (Date.now() < deadline) {
    let cursor: string | undefined
    do {
      const page = await api.listReadyCalls(cursor)
      for (const call of page.data) {
        // Ready notifications/pages can repeat; only acknowledge each call once.
        if (submitted.has(call.id)) continue
        const result = await executeTool(call.name, call.input)
        await api.submitResult(call.id, result)
        submitted.add(call.id)
        log(`[${call.name}] ${result.outcome === 'succeeded' ? 'Done' : result.content_blocks[0].text}`)
        if (call.name === 'save_plan' && result.outcome === 'succeeded') {
          log(result.content_blocks[0].text)
          log(`Plan: ${JSON.stringify(call.input, null, 2)}`)
        }
      }
      cursor = page.next_cursor ?? undefined
    } while (cursor)

    const activity = await api.getActivity()
    if (activity === 'idle') return
    if (activity === 'waiting_on_interaction') {
      throw new Error('The agent needs an answer or approval. Open its chat to inspect it.')
    }
    if (activity === 'archived') throw new Error('The agent was archived before the run finished.')
    if (activity !== 'running') throw new Error(`Unexpected agent activity: ${activity}`)
    await sleep(pollMs)
  }

  throw new Error('Tool worker timed out. Omnara may still be waiting for a tool result; inspect the chat.')
}
