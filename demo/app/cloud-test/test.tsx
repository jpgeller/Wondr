'use client';

import { useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import styles from '../agent-test/page.module.css';

export default function CloudTest({ profile }: { profile: PlanInput }) {
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');

  async function generate() {
    if (running) return;
    setRunning(true); setError(''); setPlan(null);
    try {
      const response = await fetch('/api/cloud-test', { method: 'POST' });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The request ended before a plan was returned. Please try again.');
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate the plan');
      setPlan(data.plan);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not generate the plan');
    } finally { setRunning(false); }
  }

  const time = (value: string) => new Intl.DateTimeFormat('en-US', {
    timeZone: profile.timezone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));

  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.logo}>wondr<span>✳</span></span><span className={styles.badge}>Cloud test</span></header>
    <div className={styles.intro}>
      <p className={styles.eyebrow}>A little less routine.</p>
      <h1>A day out for Joao.</h1>
      <p>One example profile. A real plan, made just for him.</p>
    </div>
    <div className={styles.columns}>
      <section className={styles.card}>
        <h2>Meet Joao</h2>
        <p className={styles.muted}>Likes chess, running, and trying new restaurants. Going solo.</p>
        <p>{profile.city}</p>
        <p className={styles.muted}>{profile.date} · 10 am–5 pm · San Francisco time</p>
        <button type="button" className={styles.primary} onClick={generate} disabled={running}>
          {running ? 'Finding Joao’s day…' : 'Generate plan ↗'}
        </button>
        <p className={styles.small}>No bookings. Keep this tab open while the plan is generated.</p>
      </section>
      <section className={styles.results} aria-live="polite">
        {error && <p className={styles.error} role="alert">{error}</p>}
        {running && <div className={styles.card}>
          <p className={styles.eyebrow}>Your day is taking shape</p><h2>Finding the good stuff…</h2>
          <p className={styles.muted}>Searching events, checking nearby places, and putting the plan together. This can take a few minutes.</p>
        </div>}
        {plan && <>
          <p className={styles.eyebrow}>Joao’s plan is ready</p>
          <h2 className={styles.planTitle}>{plan.title}</h2>
          <p>{plan.teaser}</p><p className={styles.muted}>Wear: {plan.dressCode}</p>
          {plan.stops.map((stop) => <article key={stop.position} className={styles.stop}>
            <p className={styles.eyebrow}>{time(stop.startsAt)} – {time(stop.endsAt)} · {stop.category}</p>
            <h3>{stop.title}</h3><p>{stop.description}</p>
            <p className={styles.muted}>{stop.venueName} · {stop.address}</p>
            {stop.sourceUrl && /^https?:\/\//i.test(stop.sourceUrl) && <a href={stop.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
          </article>)}
          <details className={styles.raw}><summary>View returned JSON</summary><pre>{JSON.stringify(plan, null, 2)}</pre></details>
        </>}
        {!plan && !running && !error && <div className={styles.empty}>
          <span>✳</span><h2>A good day starts here.</h2><p>Click Generate plan to find Joao’s next outing.</p>
        </div>}
      </section>
    </div>
  </main>;
}
