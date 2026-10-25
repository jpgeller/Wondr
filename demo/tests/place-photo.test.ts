import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlacePhoto } from '../lib/place-photo';

test('place photos keep credentials on the server and preserve source and author attribution', async (t) => {
  const previous = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = 'private-test-key';
  t.after(() => { if (previous === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = previous; });
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    requests.push(url);
    assert.equal(new Headers(init.headers).get('X-Goog-Api-Key'), 'private-test-key');
    assert.equal(init.cache, 'no-store');
    if (url.includes('/media?')) return Response.json({ photoUri: 'https://lh3.googleusercontent.com/venue-photo' });
    return Response.json({ photos: [{ name: 'places/abc/photos/photo123', googleMapsUri: 'https://maps.google.com/photo', authorAttributions: [{ displayName: 'Alex', uri: 'https://maps.google.com/alex' }] }] });
  });
  const photo = await getPlacePhoto('A museum', 'abc');
  assert.deepEqual(photo, { url: 'https://lh3.googleusercontent.com/venue-photo', mapsUrl: 'https://maps.google.com/photo', authors: [{ name: 'Alex', url: 'https://maps.google.com/alex' }] });
  assert.equal(JSON.stringify(photo).includes('private-test-key'), false);
  assert.equal(requests.length, 2);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ places: [] }));
  assert.equal(await getPlacePhoto('No matching venue'), null);
});
