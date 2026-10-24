'use client';

import { useEffect, useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import OnboardingLogo from './onboarding-brand';
import styles from './onboarding.module.css';

export default function MysteryReady({ plan, profile, progress, error, onStart, onBack }: {
  plan: Plan | null; profile: PlanInput; progress?: string; error?: string; onStart: () => void; onBack: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const first = plan?.stops[0];
  const date = first ? new Date(first.startsAt) : null;
  const seconds = now && date ? Math.max(0, Math.floor((date.getTime() - now) / 1000)) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const countdown = `${Math.floor(seconds / 86400)}d ${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  const confirmed = plan?.stops.filter((stop) => stop.booking.status === 'confirmed').length ?? 0;
  const timezone = profile.timezone || 'America/Los_Angeles';
  return <div className={`${styles.page} ${styles.dark}`}><main className={styles.column}>
    <header className={styles.header}><OnboardingLogo /><button className={styles.textButton} onClick={onBack}>{plan ? 'Plan another day' : 'Back'}</button></header>
    <p className={styles.eyebrow}>Your mystery day</p>
    {plan ? <>
      <h1 className={styles.readyTitle}>{plan.title}<br />{plan.stops.length} {plan.stops.length === 1 ? 'stop' : 'stops'}. Zero spoilers.</h1>
      <div className={styles.card}><p className={styles.caption}>{seconds > 0 ? 'Starts in' : 'Ready when you are'}</p><p className={styles.countdown} aria-label="Time until your day">{now === null ? '—' : seconds > 0 ? countdown : 'Let’s wander.'}</p>
        <div className={styles.details}><div><p className={styles.caption}>Be ready at</p>{date?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</div><div><p className={styles.caption}>Date</p>{date?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })}</div></div>
      </div>
      <div className={`${styles.card} ${styles.dress}`}><p className={styles.caption}>Dress code</p><p>{plan.dressCode}</p></div>
      <div className={styles.badges}><span>{plan.stops.length} {plan.stops.length === 1 ? 'stop' : 'stops'}</span><span>{profile.city}</span>{confirmed > 0 && <span>✓ {confirmed} bookings confirmed</span>}</div>
      <div className={styles.actions}><button className={styles.primary} onClick={onStart}>Start the day</button></div>
    </> : <>
      <h1 className={styles.readyTitle}>{error ? 'Let’s give that another try.' : 'A little wonder is on its way.'}</h1>
      {!error && <div className={styles.loader} aria-hidden="true" />}
      <p className={styles.intro} role="status">{error || progress || 'Your agent is finding places and checking the details. This can take a few minutes.'}</p>
      {error && <button className={styles.primary} onClick={onBack}>Back to my answers</button>}
    </>}
  </main></div>;
}
