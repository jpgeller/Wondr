import { randomUUID } from 'node:crypto';
import { generateOmnaraPlan } from '@/lib/agent/omnara';
import { cloudTestEnabled, exampleProfile } from '@/lib/agent/example-profile';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Fixed sample profile, team-protected preview, no database or app login.
export async function POST(request: Request) {
  if (!cloudTestEnabled()) return new Response('Not found', { status: 404 });
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return new Response('Use the Generate plan button on this site', { status: 403 });
  }
  try {
    const plan = await generateOmnaraPlan(exampleProfile(), randomUUID());
    return Response.json({ plan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The planner could not finish';
    console.error('[cloud-test]', message);
    return Response.json({ error: message }, { status: 502 });
  }
}
