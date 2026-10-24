import { bearerToken, createOmnaraClient, sdk } from '@omnara/sdk'
import { runToolWorker } from './tool-worker.ts'
import type { executeTool } from './tools/index.ts'

const project = {
  orgID: 'org_vc7l6n4ix2hhbny7x6xvbfey5e',
  projectID: 'proj_agqw7dscfn7kld6dcv2re2dnxe',
}

// No .env loading here: callers supply normal environment variables.
export async function runAgent(options: {
  source: string
  message: string
  runId: string
  execute: typeof executeTool
  onCreated?: (agentID: string) => Promise<void>
  timeoutMs?: number
}) {
  if (!process.env.OMNARA_TOKEN) throw new Error('OMNARA_TOKEN must be set')
  const client = createOmnaraClient({
    baseUrl: 'https://api.omnara.com/v1', auth: bearerToken(process.env.OMNARA_TOKEN),
  })
  const signal = AbortSignal.timeout(options.timeoutMs ?? 240_000)
  const requestSignal = () => AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  let agentID: string | undefined
  try {
    const result = await sdk.createAgent({
      client, path: project, signal: requestSignal(),
      headers: { 'Idempotency-Key': options.runId },
      body: {
        config_source: { source: options.source, source_format: 'yaml' },
        name: 'Wondr planner', message: options.message,
      },
    })
    agentID = result.data.agent.id
    const path = { ...project, agentID }
    await options.onCreated?.(agentID)
    await runToolWorker({
      async listReadyCalls(cursor) {
        const response = await sdk.listToolCalls({
          client, path, signal: requestSignal(),
          query: { type: 'custom', state: 'ready', limit: 100, ...(cursor ? { cursor } : {}) },
        })
        return response.data
      },
      async submitResult(toolCallID, body) {
        await sdk.submitToolCallResult({ client, path: { ...path, toolCallID }, body, signal: requestSignal() })
      },
      async getActivity() {
        const response = await sdk.getAgent({ client, path, signal: requestSignal() })
        return response.data.agent.activity?.state ?? 'unknown'
      },
    }, { signal, execute: options.execute, log: () => {}, timeoutMs: options.timeoutMs ?? 240_000 })
    return { agentID }
  } catch (error) {
    if (agentID) {
      // Stop spending on a run whose tool worker can no longer serve it.
      await sdk.cancelAgent({
        client, path: { ...project, agentID },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {})
    }
    if (signal.aborted) throw new Error('Planning timed out. Try a shorter outing or fewer interests.')
    throw error
  }
}
