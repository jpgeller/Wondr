// Google interprets the agent's full query, including any city or neighborhood.
export async function search_places({ query }: Record<string, unknown>): Promise<string> {
  if (typeof query !== 'string' || !query.trim()) throw new Error('query must be a non-empty string.')
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key || key.startsWith('replace_')) throw new Error('Set GOOGLE_PLACES_API_KEY in agent/.env.')

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.currentOpeningHours,places.businessStatus,places.attributions',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 5 }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Google Places search failed (${response.status}): ${await response.text()}`)
  return JSON.stringify(await response.json())
}
