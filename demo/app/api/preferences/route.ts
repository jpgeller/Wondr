import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { PreferencesSchema, savedPreferences } from '@/lib/preferences';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data, error } = await db().from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load your preferences.' }, { status: 500 });
  return NextResponse.json({ preferences: savedPreferences(data, user.user_metadata) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Use the form on this site.' }, { status: 403 });
  const parsed = PreferencesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check your answers and try again.' }, { status: 400 });
  const p = parsed.data;
  const row = {
    user_id: user.id, display_name: p.name, city: p.city,
    default_window_start: p.windowStart, default_window_end: p.windowEnd,
    interests: p.interests, dislikes: p.dislikes, dietary: p.dietary,
    default_budget: p.budget, energy_level: p.energy, max_travel_miles: p.travel,
    updated_at: new Date().toISOString(),
  };
  let { error } = await db().from('profiles').upsert(row);
  if (error && /energy_level|max_travel_miles/.test(error.message)) {
    const base: Record<string, unknown> = { ...row };
    delete base.energy_level; delete base.max_travel_miles;
    ({ error } = await db().from('profiles').upsert(base));
  }
  if (error) return NextResponse.json({ error: 'Could not save your taste. Please try again.' }, { status: 500 });
  // Account metadata keeps the complete form without requiring a new database migration.
  const { error: memoryError } = await db().auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, wondr_preferences: p },
  });
  if (memoryError) return NextResponse.json({ error: 'Could not save all your answers. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
