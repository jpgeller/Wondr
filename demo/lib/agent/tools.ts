// The agent's real-world tools (spec section 7): search_venues, get_venue_details,
// check_travel_time. Each one degrades instead of throwing where it can, so a flaky
// provider costs a candidate, not the whole plan.

export type SearchResult = {
  url: string;
  title: string;
  text: string; // snippet from the search provider
};

// ----------------------------------------------------------- search_venues

/** Exa search for real venue pages. */
export async function searchVenues(query: string, numResults = 6): Promise<SearchResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('EXA_API_KEY is not set');
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({
      query,
      numResults,
      type: 'auto',
      // Aggregators list many venues on one page; we want one venue per result.
      excludeDomains: ['yelp.com', 'tripadvisor.com', 'timeout.com', 'reddit.com', 'eater.com', 'thrillist.com'],
      contents: { text: { maxCharacters: 2500 } },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.results ?? [])
    .filter((r: { url?: string }) => r.url)
    .map((r: { url: string; title?: string; text?: string }) => ({
      url: r.url,
      title: r.title ?? '',
      text: r.text ?? '',
    }));
}

// ------------------------------------------------------- get_venue_details

/** context.dev scrape of a venue page as Markdown: hours, prices, booking links, contact email. */
export async function getVenueDetails(url: string, maxChars = 7000): Promise<string | null> {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.context.dev/v1/web/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: { markdown: true }, sharedParams: { mainContentOnly: true } }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md: string | undefined = data?.markdown?.success ? data.markdown.data : undefined;
    return md ? md.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- check_travel_time

export type LatLng = { lat: number; lng: number };

let lastGeocode = 0;

/** OpenStreetMap Nominatim geocoder. Free, 1 request per second, needs a User-Agent. */
export async function geocode(address: string): Promise<LatLng | null> {
  const wait = lastGeocode + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'wondr-hackathon/0.1 (mystery day planner)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

export type Travel = { minutes: number; mode: 'walk' | 'transit'; km: number; estimated: boolean };

/**
 * Travel time between two points. A straight-line estimate: walk under 1.5 km, otherwise
 * city transit or rideshare at about 18 km/h door to door plus 8 minutes to get going.
 * Unknown coordinates count as 25 minutes so a missing geocode never blocks a plan.
 */
export function checkTravelTime(from: LatLng | null | undefined, to: LatLng | null | undefined): Travel {
  if (!from || !to) return { minutes: 25, mode: 'transit', km: 0, estimated: true };
  const km = haversineKm(from, to) * 1.3; // streets are not straight lines
  if (km < 1.5) return { minutes: Math.max(5, Math.round((km / 4.8) * 60)), mode: 'walk', km, estimated: false };
  return { minutes: Math.round((km / 18) * 60 + 8), mode: 'transit', km, estimated: false };
}

function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
