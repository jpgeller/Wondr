// POST /api/plan/replan  ReplanRequest  ->  202 {}
// Running late, skip or swap. Rewrites plans.result from fromPosition on; progress
// messages show up on the timeline like during planning.

import { after, NextResponse } from 'next/server';
import { runReplan } from '@/lib/agent';
import { currentUserId } from '@/lib/agent/auth';
import { getPlanRow } from '@/lib/agent/db';
import type { ReplanRequest } from '@/lib/types';

export const maxDuration = 300;

const REASONS = ['running_late', 'skip', 'swap'];

export async function POST(req: Request) {
  const userId = await currentUserId(req);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ReplanRequest | null;
  if (!body?.planId || !REASONS.includes(body.reason) || !Number.isInteger(body.fromPosition))
    return NextResponse.json({ error: 'planId, reason and fromPosition are required' }, { status: 400 });

  const row = await getPlanRow(body.planId);
  if (!row || row.user_id !== userId) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  if (row.status !== 'ready' || !row.result) return NextResponse.json({ error: 'Plan is not ready' }, { status: 409 });

  after(() => runReplan(body));
  return NextResponse.json({}, { status: 202 });
}
