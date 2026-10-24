// POST /api/plan  { planId }  ->  202 {}
// The app inserts a plans row (status planning, input snapshot) and calls this. The agent
// runs after the response is sent; the timeline follows the row through realtime.

import { after, NextResponse } from 'next/server';
import { runPlan } from '@/lib/agent';
import { currentUserId } from '@/lib/agent/auth';
import { getPlanRow } from '@/lib/agent/db';
import type { PlanRequest } from '@/lib/types';

export const maxDuration = 300; // seconds; the Vercel plan must allow it

export async function POST(req: Request) {
  const userId = await currentUserId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as PlanRequest | null;
  if (!body?.planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 });

  const row = await getPlanRow(body.planId);
  if (!row || row.user_id !== userId) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  if (row.status !== 'planning') return NextResponse.json({ error: `Plan is ${row.status}` }, { status: 409 });
  if (row.progress.length > 0) return NextResponse.json({ error: 'Plan is already running' }, { status: 409 });

  after(() => runPlan(row.id));
  return NextResponse.json({}, { status: 202 });
}
