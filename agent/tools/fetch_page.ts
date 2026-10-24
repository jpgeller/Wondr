// Reuse the Exa key to read a page; no second content provider is needed.
export async function fetch_page({ url }: Record<string, unknown>): Promise<string> {
  if (typeof url !== 'string' || !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error('url must be an HTTP or HTTPS URL.')
  }
  const key = process.env.EXA_API_KEY
  if (!key || key.startsWith('replace_')) throw new Error('Set EXA_API_KEY in agent/.env.')

  const response = await fetch('https://api.exa.ai/contents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ urls: [url], text: { maxCharacters: 12000 } }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Exa page fetch failed (${response.status}): ${await response.text()}`)
  return JSON.stringify(await response.json())
}
