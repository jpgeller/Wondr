import { setTimeout as sleep } from 'node:timers/promises'
import { executeTool, type ToolResult } from './tools/index.ts'

type PendingCall = { id: string; name: string; input: unknown }

export type ToolWorkerApi = {
  listReadyCalls: (cursor?: string) => Promise<{ data: PendingCall[]; next_cursor: string | null }>
  submitResult: (callID: string, result: ToolResult) => Promise<void>
  getActivity: () => Promise<string>
}

// Used by both the CLI and the bounded Vercel demo run.
export async function runToolWorker(
  api: ToolWorkerApi,
  options: {
    pollMs?: number
    timeoutMs?: number
    log?: (message: string) => void
    execute?: typeof executeTool
    signal?: AbortSignal
  } = {},
): Promise<void> {
  const { pollMs = 3000, timeoutMs = 300_000, log = console.log, execute = executeTool, signal } = options
  const deadline = Date.now() + timeoutMs
  const submitted = new Set<string>()

  while (Date.now() < deadline) {
    let cursor: string | undefined
    do {
      signal?.throwIfAborted()
      const page = await api.listReadyCalls(cursor)
      for (const call of page.data) {
        signal?.throwIfAborted()
        if (Date.now() >= deadline) throw new Error('Tool worker timed out.')
        // Ready notifications/pages can repeat; only acknowledge each call once.
        if (submitted.has(call.id)) continue
        const result = await execute(call.name, call.input)
        signal?.throwIfAborted()
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
    await sleep(pollMs, undefined, { signal })
  }

  throw new Error('Tool worker timed out. Omnara may still be waiting for a tool result; inspect the chat.')
}
