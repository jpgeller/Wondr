import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

// The CLI saves locally; the web app supplies a Supabase save function to executeTool.
export async function save_plan(plan: Record<string, unknown>): Promise<string> {
  const { stops } = plan
  const fields = ['startsAt', 'endsAt', 'title', 'venueName', 'category', 'address', 'sourceUrl', 'description']
  if (!Array.isArray(stops) || stops.length > 3 || stops.some((stop) =>
    !stop || typeof stop !== 'object' || fields.some((field) => typeof stop[field] !== 'string'),
  )) {
    throw new Error('stops must contain up to three objects with startsAt, endsAt, title, venueName, category, address, sourceUrl, and description strings.')
  }

  const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../output')
  await mkdir(directory, { recursive: true })
  const file = join(directory, `plan-${randomUUID()}.json`)
  await writeFile(file, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' })
  return JSON.stringify({ saved: true, file })
}
