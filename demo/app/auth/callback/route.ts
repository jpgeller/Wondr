// GET /auth/callback?code=...&next=/...
// Google sends the user back here through Supabase. We turn the one-time code into a
// login session, and save Google's refresh token right away: Supabase only hands it
// over in this one moment, never again (spec section 8).

import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    const reason = searchParams.get('error_description') ?? 'Missing login code';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message ?? 'Login failed')}`);
  }

  const { user, provider_refresh_token } = data.session;

  if (provider_refresh_token) {
    const { error: tokenError } = await db().from('google_tokens').upsert({
      user_id: user.id,
      refresh_token: encrypt(provider_refresh_token),
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      updated_at: new Date().toISOString(),
    });
    if (tokenError) console.error('[auth] saving Google refresh token failed', tokenError.message);
  } else {
    console.warn('[auth] no Google refresh token in this login; calendar sync will be off for', user.email);
  }

  // Create the profile row on first login, without touching an existing one.
  const { error: profileError } = await db()
    .from('profiles')
    .upsert(
      { user_id: user.id, display_name: user.user_metadata?.full_name ?? user.email },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
  if (profileError) console.error('[auth] creating profile failed', profileError.message);

  return NextResponse.redirect(`${origin}${safeNext}`);
}
