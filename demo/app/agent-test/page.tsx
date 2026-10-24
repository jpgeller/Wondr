'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { PlanInput, PlanRow } from '@/lib/types';
import styles from './page.module.css';

export default function AgentTest() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [name, setName] = useState('Joao');
  const [city, setCity] = useState('Mission District, San Francisco');
  const [interests, setInterests] = useState('Chess, running, trying new restaurants');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('17:00');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const running = starting || plan?.status === 'planning';

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(tomorrow));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError('Supabase is not configured on this deployment.');
      setAuthReady(true);
      return;
    }
    const supabase = supabaseBrowser();
    setClient(supabase);
    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      if (error) setError(error.message);
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

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!client || !session || running) return;
    setStarting(true);
    setError('');
    setPlan(null);
    setPlanId(null);
    try {
      const input: PlanInput = {
        date, windowStart: start, windowEnd: end, timezone, city,
        interests: interests.split(',').map((value) => value.trim()).filter(Boolean),
        vibe: 'Going alone. A relaxed outing with time to travel between stops.',
        organizer: { name, email: session.user.email! },
        bookingConsent: false,
      };
      const { data, error: insertError } = await client.from('plans').insert({
        user_id: session.user.id, status: 'planning', input, progress: [],
      }).select('*').single();
      if (insertError) throw insertError;
      const { data: auth } = await client.auth.getSession();
      const response = await fetch('/api/plan', {
        method: 'POST', headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${auth.session?.access_token}`,
        }, body: JSON.stringify({ planId: data.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start the planner');
      window.history.replaceState(null, '', `/agent-test?plan=${data.id}`);
      setPlanId(data.id);
      setPlan(data as PlanRow);
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Could not generate a plan');
    } finally { setStarting(false); }
  }

  function time(value: string) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: plan?.input.timezone || timezone, hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>wondr<span>✳</span></Link>
        <span className={styles.badge}>Agent test</span>
      </header>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>A little less routine.</p>
        <h1>Let’s make a day of it.</h1>
        <p>Try a profile. Find a few nearby places worth stepping out for.</p>
      </div>
      <div className={styles.columns}>
        <section className={styles.card}>
          <h2>Your starting point</h2>
          <p className={styles.muted}>Joao’s example is filled in. Change anything you like.</p>
          <form onSubmit={generate}>
            <fieldset disabled={!!running}>
              <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></label>
              <label>Location<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={200} required /></label>
              <label>Interests<textarea value={interests} onChange={(e) => setInterests(e.target.value)} rows={3} required /></label>
              <div className={styles.row}>
                <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
                <label>From<input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
                <label>Until<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
              </div>
              <label>Timezone<input value={timezone} onChange={(e) => setTimezone(e.target.value)} required /></label>
            </fieldset>
            {session ? <>
              <button className={styles.primary} disabled={!!running || end <= start || !date} type="submit">
                {running ? 'Finding your day…' : 'Generate plan ↗'}
              </button>
              <p className={styles.small}>Signed in as {session.user.email}. No bookings will be made.</p>
              <button className={styles.textButton} type="button" disabled={!!running} onClick={async () => {
                await client!.auth.signOut(); setPlan(null); setPlanId(null);
                window.history.replaceState(null, '', '/agent-test');
              }}>Sign out</button>
            </> : <>
              <button className={styles.primary} type="button" disabled={!client || !authReady} onClick={() => {
                window.location.href = '/login?next=%2Fagent-test';
              }}>
                {authReady ? 'Sign in with Google' : 'Checking sign-in…'}
              </button>
              <p className={styles.small}>Sign in to generate and save your plan.</p>
            </>}
          </form>
        </section>
        <section className={styles.results} aria-live="polite">
          {error && <p className={styles.error} role="alert">{error}</p>}
          {plan?.status === 'failed' && <p className={styles.error} role="alert">{plan.error || 'This plan could not be completed. Please try again.'}</p>}
          {running && <div className={styles.card}>
            <p className={styles.eyebrow}>Your day is taking shape</p>
            <h2>Finding the good stuff…</h2>
            <p className={styles.muted}>This usually takes a few minutes. You can leave this page and come back.</p>
            <ol className={styles.progress}>{plan?.progress.map((item, index) => <li key={index}>{item.message}</li>)}</ol>
          </div>}
          {plan?.status === 'ready' && plan.result ? <>
            <p className={styles.eyebrow}>Your plan is ready</p>
            <h2 className={styles.planTitle}>{plan.result.title}</h2>
            <p>{plan.result.teaser}</p>
            <p className={styles.muted}>Wear: {plan.result.dressCode}</p>
            {plan.result.stops.map((stop) => <article key={stop.position} className={styles.stop}>
              <p className={styles.eyebrow}>{time(stop.startsAt)} – {time(stop.endsAt)} · {stop.category}</p>
              <h3>{stop.title}</h3>
              <p>{stop.description}</p>
              <p className={styles.muted}>{stop.venueName} · {stop.address}</p>
              {stop.sourceUrl && /^https?:\/\//i.test(stop.sourceUrl) && <a href={stop.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
            </article>)}
            <details className={styles.raw}><summary>View returned JSON</summary><pre>{JSON.stringify(plan.result, null, 2)}</pre></details>
          </> : !running && plan?.status !== 'failed' && <div className={styles.empty}>
            <span>✳</span><h2>A good day starts here.</h2>
            <p>Your plan will appear here, with times, places, and links to the sources.</p>
          </div>}
        </section>
      </div>
    </main>
  );
}
