// Pass the agent's query straight to Exa. No added keywords or domain filters.
export async function search_events({ query }: Record<string, unknown>): Promise<string> {
  if (typeof query !== 'string' || !query.trim()) throw new Error('query must be a non-empty string.')
  const key = process.env.EXA_API_KEY
  if (!key || key.startsWith('replace_')) throw new Error('Set EXA_API_KEY in agent/.env.')

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ query, numResults: 5, contents: { text: { maxCharacters: 2000 } } }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Exa search failed (${response.status}): ${await response.text()}`)
  return JSON.stringify(await response.json())
}
