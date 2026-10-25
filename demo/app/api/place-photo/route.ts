import { z } from 'zod';
import { currentUser } from '@/lib/supabase/server';
import { cloudTestEnabled } from '@/lib/agent/example-profile';
import { getPlacePhoto } from '@/lib/place-photo';

const PhotoRequest = z.object({ query: z.string().trim().min(1).max(500), placeId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(300).optional() });

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
  if (!cloudTestEnabled() && !await currentUser()) return new Response('Sign in required', { status: 401 });
  const input = PhotoRequest.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'Invalid place' }, { status: 400 });
  try {
    return Response.json({ photo: await getPlacePhoto(input.data.query, input.data.placeId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.warn('[place-photo]', error instanceof Error ? error.message : 'Photo unavailable');
    return Response.json({ photo: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
