import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Local output for now. Replace this write with a database call when connecting the frontend.
export async function save_plan({ stops }: Record<string, unknown>): Promise<string> {
  const fields = ['time', 'title', 'address', 'url', 'why']
  if (!Array.isArray(stops) || stops.length > 3 || stops.some((stop) =>
    !stop || typeof stop !== 'object' || fields.some((field) => typeof stop[field] !== 'string'),
  )) {
    throw new Error('stops must contain up to three objects with time, title, address, url, and why strings.')
  }

  const directory = new URL('../output/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const file = new URL(`plan-${randomUUID()}.json`, directory)
  await writeFile(file, JSON.stringify({ stops }, null, 2) + '\n', { flag: 'wx' })
  return JSON.stringify({ saved: true, file: fileURLToPath(file) })
}
