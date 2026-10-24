// POST /api/calendar/reveal  { planId, positions?: number[] }  ->  { patched }
// The timeline calls this when stops unlock. Without `positions`, every stop whose
// reveal time has passed (startsAt - 45 min) is patched. Demo mode passes the positions
// it has revealed on its fast clock. Patching an already revealed event is harmless.

import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/agent/auth';
import { getPlanRow } from '@/lib/agent/db';
import { revealEvents } from '@/lib/calendar';
import { isRevealed } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const userId = await currentUserId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { planId?: string; positions?: number[] } | null;
  if (!body?.planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 });

  const row = await getPlanRow(body.planId);
  if (!row || row.user_id !== userId) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  if (!row.result) return NextResponse.json({ error: 'Plan is not ready' }, { status: 409 });

  const positions = Array.isArray(body.positions)
    ? body.positions.filter((p) => Number.isInteger(p))
    : row.result.stops.filter((s) => isRevealed(s)).map((s) => s.position);

  try {
    const patched = await revealEvents(row.id, positions);
    return NextResponse.json({ patched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar update failed';
    console.error('[calendar] reveal failed', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
