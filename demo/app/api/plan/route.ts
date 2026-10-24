// POST /api/plan  { planId }  ->  202 {}
// The app inserts a plans row (status planning, input snapshot) and calls this. The agent
// runs after the response is sent; the timeline follows the row through realtime.

import { after, NextResponse } from 'next/server';
import { checkAgentEnvironment, runOmnaraPlan } from '@/lib/agent/omnara';
import { PlanInputSchema } from '@/lib/agent/omnara-plan';
import { currentUserId } from '@/lib/agent/auth';
import { claimPlan, getPlanRow } from '@/lib/agent/db';
import type { PlanRequest } from '@/lib/types';
import { z } from 'zod';

export const maxDuration = 300; // seconds; the Vercel plan must allow it
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const userId = await currentUserId(req);
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as PlanRequest | null;
    if (!body || !z.uuid().safeParse(body.planId).success) return NextResponse.json({ error: 'A valid planId is required' }, { status: 400 });

    const row = await getPlanRow(body.planId);
    if (!row || row.user_id !== userId) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    if (row.status !== 'planning') return NextResponse.json({ error: `Plan is ${row.status}` }, { status: 409 });
    if (row.progress.length > 0) return NextResponse.json({ error: 'Plan is already running' }, { status: 409 });

    if (!PlanInputSchema.safeParse(row.input).success) return NextResponse.json({ error: 'Check the profile, date, timezone, and time window' }, { status: 400 });
    checkAgentEnvironment();
    if (!await claimPlan(row.id, userId)) return NextResponse.json({ error: 'Plan is already running' }, { status: 409 });
    after(() => runOmnaraPlan(row.id));
    return NextResponse.json({}, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start the planner';
    console.error('[plan] start failed', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
