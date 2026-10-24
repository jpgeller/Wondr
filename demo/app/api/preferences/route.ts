// POST /api/preferences  -> saves the signed-in user's profile (from /preferences).
// Server-side with the service key, so it works whatever the table's row-level policies are.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const list = z.array(z.string().trim().min(1).max(100)).max(30);

const Body = z.object({
  city: z.string().trim().min(1).max(200),
  default_window_start: hhmm,
  default_window_end: hhmm,
  interests: list.min(1),
  dislikes: list,
  dietary: list,
  default_budget: z.number().int().min(0).max(10000),
  energy_level: z.string().max(30),
  max_travel_miles: z.number().int().min(1).max(100),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check your answers and try again' }, { status: 400 });

  const row = { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() };
  let { error } = await db().from('profiles').upsert(row);
  // Databases without the two newer columns still save everything else.
  if (error && /energy_level|max_travel_miles/.test(error.message)) {
    const { energy_level: _e, max_travel_miles: _m, ...base } = row;
    ({ error } = await db().from('profiles').upsert(base));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
