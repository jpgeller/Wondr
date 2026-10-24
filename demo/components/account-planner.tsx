'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { exampleProfile } from '@/lib/agent/example-profile';
import type { PlanInput, PlanRow } from '@/lib/types';
import PlannerView from './planner-view';

export default function AccountPlanner({ initialName, calendarConnected }: { initialName?: string; calendarConnected?: boolean }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(() => ({ ...exampleProfile(), vibe: 'Going alone. A relaxed outing with time to travel between stops.' }));
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const running = starting || (plan?.status === 'planning' && !error);
  const name = initialName || session?.user.user_metadata?.full_name || session?.user.email || 'You';

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError('Sign-in is not configured on this deployment.'); setAuthReady(true); return;
    }
    const supabase = supabaseBrowser();
    setClient(supabase);
    supabase.auth.getSession().then(async ({ data, error }) => {
      setSession(data.session);
      if (error) setError(error.message);
      if (data.session) {
        const { data: saved } = await supabase.from('profiles').select('city, interests, default_window_start, default_window_end').eq('user_id', data.session.user.id).maybeSingle();
        if (saved) setProfile((base) => ({
          ...base, city: saved.city || base.city, interests: saved.interests?.length ? saved.interests : base.interests,
          windowStart: saved.default_window_start?.slice(0, 5) || base.windowStart,
          windowEnd: saved.default_window_end?.slice(0, 5) || base.windowEnd,
        }));
      }
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const id = new URL(window.location.href).searchParams.get('plan');
    if (id) setPlanId(id);
  }, [session]);

  useEffect(() => {
    if (!client || !session || !planId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const { data, error } = await client!.from('plans').select('*').eq('id', planId).single();
      if (disposed) return;
      if (error) { setError(error.message); return; }
      setPlan(data as PlanRow);
      if (data.status === 'planning') timer = setTimeout(refresh, 2000);
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); };
  }, [client, session, planId]);

  async function generate(values: PlanInput) {
    if (!client || !session || running) return;
    setStarting(true); setError(''); setPlan(null); setPlanId(null);
    try {
      const input: PlanInput = { ...values, organizer: { name, email: session.user.email! }, bookingConsent: false };
      const { data, error: insertError } = await client.from('plans').insert({
        user_id: session.user.id, status: 'planning', input, progress: [],
      }).select('*').single();
      if (insertError) throw insertError;
      const { data: auth } = await client.auth.getSession();
      const response = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token}` },
        body: JSON.stringify({ planId: data.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start the planner');
      const url = new URL(window.location.href);
      url.searchParams.set('plan', data.id);
      window.history.replaceState(null, '', url);
      setPlanId(data.id); setPlan(data as PlanRow);
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Could not generate a plan');
    } finally { setStarting(false); }
  }

  return <PlannerView key={authReady ? 'ready' : 'loading'} profile={profile} resultProfile={plan?.input} onGenerate={generate}
    running={running} plan={plan?.status === 'ready' ? plan.result : null}
    error={error || (plan?.status === 'failed' ? plan.error || 'This plan could not be completed. Please try again.' : '')}
    progress={plan?.progress.at(-1)?.message} disabled={!authReady || !client}
    actionLabel={!session ? (authReady ? 'Continue with Google' : 'Checking sign-in…') : undefined}
    onSignIn={!session ? () => { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; } : undefined}
    note={calendarConnected === false ? 'Calendar not connected. Sign out and in to connect it.' : 'Your day, saved for later. No bookings will be made.'}
    account={<><span>{String(name).split(' ')[0]}</span>{session && <><Link href="/preferences">Your taste</Link><form action="/auth/signout" method="post"><button type="submit">Sign out</button></form></>}</>} />;
}
