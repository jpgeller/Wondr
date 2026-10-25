export type PlacePhoto = {
  url: string;
  mapsUrl?: string;
  authors: { name: string; url?: string }[];
};

function webUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : undefined;
}

// Fetch a fresh photo reference each time: Google's photo names can expire.
// Only the durable place ID is saved with a plan; API credentials stay on the server.
export async function getPlacePhoto(query: string, placeId?: string): Promise<PlacePhoto | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const response = await fetch(placeId
    ? `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
    : 'https://places.googleapis.com/v1/places:searchText', {
    method: placeId ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': placeId ? 'photos,googleMapsUri' : 'places.photos,places.googleMapsUri' },
    ...(placeId ? {} : { body: JSON.stringify({ textQuery: query, pageSize: 1 }) }),
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Place photo lookup failed (${response.status})`);
  const data = await response.json();
  const place = placeId ? data : data.places?.[0];
  const photo = place?.photos?.[0];
  if (!photo || typeof photo.name !== 'string' || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)) return null;
  const media = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`, {
    headers: { 'X-Goog-Api-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!media.ok) throw new Error(`Place photo download failed (${media.status})`);
  const { photoUri } = await media.json();
  if (!webUrl(photoUri)) return null;
  const host = new URL(photoUri).hostname;
  if (!host.endsWith('.googleusercontent.com') && !host.endsWith('.ggpht.com')) return null;
  return {
    url: photoUri, mapsUrl: webUrl(photo.googleMapsUri) || webUrl(place.googleMapsUri),
    authors: (photo.authorAttributions || []).map((author: { displayName?: string; uri?: string }) => ({
      name: author.displayName || 'Photo contributor', url: webUrl(author.uri),
    })),
  };
}
