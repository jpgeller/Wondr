import { randomUUID } from 'node:crypto';
import { generateOmnaraPlan } from '@/lib/agent/omnara';
import { cloudTestEnabled, exampleProfile } from '@/lib/agent/example-profile';
import { PlanInputSchema } from '@/lib/agent/omnara-plan';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Protected preview: exercise the same profile and agent input without a database.
export async function POST(request: Request) {
  if (!cloudTestEnabled()) return new Response('Not found', { status: 404 });
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return new Response('Use the Generate plan button on this site', { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Choose a location, date, and time window.' }, { status: 400 });
  }
  const input = PlanInputSchema.safeParse({
    ...exampleProfile(), ...body, city: body.city, date: body.date,
    windowStart: body.windowStart, windowEnd: body.windowEnd,
  });
  if (!input.success) return Response.json({ error: 'Enter a valid location, date, and an end time later than the start.' }, { status: 400 });
  try {
    const plan = await generateOmnaraPlan(input.data, randomUUID());
    return Response.json({ plan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The planner could not finish';
    console.error('[cloud-test]', message);
    return Response.json({ error: message }, { status: 502 });
  }
}
