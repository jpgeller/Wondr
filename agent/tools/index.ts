import { search_events } from './search_events.ts'
import { search_places } from './search_places.ts'
import { fetch_page } from './fetch_page.ts'
import { save_plan } from './save_plan.ts'

const tools = { search_events, search_places, fetch_page, save_plan }

export type ToolResult = {
  outcome: 'succeeded' | 'failed'
  content_blocks: { type: 'text'; text: string }[]
}

// This is the only Omnara-specific part: turn a function result into a tool reply.
export async function executeTool(
  name: string,
  input: unknown,
  savePlan: typeof save_plan = save_plan,
): Promise<ToolResult> {
  try {
    if (!Object.hasOwn(tools, name)) throw new Error(`Unknown tool: ${name}`)
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Tool input must be a JSON object.')
    }
    const tool = name === 'save_plan' ? savePlan : tools[name as keyof typeof tools]
    const text = await tool(input as Record<string, unknown>)
    return { outcome: 'succeeded', content_blocks: [{ type: 'text', text }] }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Tool execution failed.'
    return { outcome: 'failed', content_blocks: [{ type: 'text', text }] }
  }
}
