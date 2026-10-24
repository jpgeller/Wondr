'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import type { Plan, PlanInput, Stop } from '@/lib/types';
import WondrShell from './wondr-shell';
import styles from './planner.module.css';

type Props = {
  profile: PlanInput;
  account: ReactNode;
  onGenerate: (input: PlanInput) => Promise<void>;
  running: boolean;
  plan: Plan | null;
  resultProfile?: PlanInput;
  error?: string;
  progress?: string;
  disabled?: boolean;
  actionLabel?: string;
  onSignIn?: () => void;
  note?: string;
};

function photoFor(stop: Stop) {
  const subject = `${stop.category} ${stop.title} ${stop.description}`.toLowerCase();
  if (/chess|board game/.test(subject)) return { file: 'chess.jpg', alt: 'Chess pieces on a board' };
  if (/food|restaurant|lunch|dinner|brunch|cafe|bar\b/.test(subject)) return { file: 'restaurant.jpg', alt: 'A softly lit restaurant interior' };
  return { file: 'park.jpg', alt: 'People enjoying a grassy hillside in San Francisco' };
}

export default function PlannerView(props: Props) {
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState<Stop | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLElement>(null);
  const resultProfile = props.resultProfile ?? props.profile;
  const time = (value: string) => new Intl.DateTimeFormat('en-US', {
    timeZone: resultProfile.timezone ?? 'America/Los_Angeles', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value)).toLowerCase();

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);

  useEffect(() => {
    setRevealed([]);
    if (props.plan && window.matchMedia('(max-width: 760px)').matches) {
      results.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    }
  }, [props.plan]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.running || props.disabled) return;
    if (props.onSignIn) { props.onSignIn(); return; }
    const form = new FormData(event.currentTarget);
    const city = String(form.get('location') ?? '').trim();
    const date = String(form.get('date') ?? '');
    const start = String(form.get('start') ?? '');
    const end = String(form.get('end') ?? '');
    if (!city.trim() || end <= start) {
      setFormError(!city.trim() ? 'Enter a location.' : 'Choose an end time later than the start time.');
      return;
    }
    setFormError('');
    await props.onGenerate({ ...props.profile, city: city.trim(), date, windowStart: start, windowEnd: end });
  }

  const error = formError || props.error;
  const selectedPhoto = selected ? photoFor(selected) : null;

  return <WondrShell account={props.account}>
    <main className={styles.main}>
      <section className={styles.planner} aria-labelledby="planner-title">
        <h1 id="planner-title">Plan a day.</h1>
        <p className={styles.intro}>Choose when and where. Leave the rest open.</p>
        <form id="plan-form" className={styles.form} onSubmit={submit}>
          <fieldset disabled={props.running || props.disabled}>
            <div className={styles.field}>
              <label htmlFor="location">Location</label>
              <input id="location" name="location" defaultValue={props.profile.city} autoComplete="address-level2" maxLength={200} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="date">Date</label>
              <input id="date" name="date" type="date" defaultValue={props.profile.date} required />
            </div>
            <div className={styles.timeFields}>
              <div className={styles.field}><label htmlFor="start">From</label><input id="start" name="start" type="time" defaultValue={props.profile.windowStart} required /></div>
              <div className={styles.field}><label htmlFor="end">Until</label><input id="end" name="end" type="time" defaultValue={props.profile.windowEnd} required /></div>
            </div>
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.generate} type="submit" disabled={props.running || props.disabled}>
            {props.running ? 'Generating…' : props.actionLabel ?? (props.plan ? 'Generate again' : 'Generate plan')}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className={styles.note}>{props.note ?? 'No bookings. Just a little possibility.'}</p>
        <p className={styles.note}>Times in {props.profile.timezone?.replaceAll('_', ' ').split('/').pop() ?? 'Los Angeles'}.</p>
      </section>

      {(props.running || props.plan) && <section ref={results} className={styles.results} aria-labelledby="results-title" aria-busy={props.running}>
        <div className={styles.resultsHeading}>
          <h2 id="results-title">{props.running ? 'Making room for wonder.' : 'Your day'}</h2>
          {!props.running && props.plan && <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${props.plan.date}T12:00:00Z`))}</span>}
        </div>
        {props.running ? <>
          <p className={styles.loadingText} role="status">{props.progress || 'Finding places, checking the details, and putting your day together.'}</p>
          <div className={styles.loadingLine} aria-hidden="true" />
          <p className={styles.resultsNote}>Good days take a little planning. This can take a few minutes.</p>
        </> : props.plan && <>
          <p className={styles.resultLocation}>{resultProfile.city}</p>
          {props.plan.stops.map((stop, index) => {
            const next = props.plan!.stops[index + 1];
            const gap = next ? Math.round((Date.parse(next.startsAt) - Date.parse(stop.endsAt)) / 60_000) : 0;
            return <div key={stop.position}>
              <button className={styles.stop} type="button" aria-haspopup="dialog"
                aria-label={`Reveal stop ${index + 1}, ${time(stop.startsAt)} to ${time(stop.endsAt)}`}
                onClick={() => { setSelected(stop); setRevealed((previous) => [...previous, stop.position]); }}>
                <span className={styles.stopTime}>{time(stop.startsAt)} – {time(stop.endsAt)}</span>
                <span className={styles.stopArrow} aria-hidden="true">↗</span>
                <span className={styles.stopHint}>{revealed.includes(stop.position) ? stop.venueName : `Stop ${String(index + 1).padStart(2, '0')} · Open to discover`}</span>
              </button>
              {gap > 0 && <p className={styles.travel}>{gap} min between stops</p>}
            </div>;
          })}
          <p className={styles.resultsNote}>Open a stop when you’re ready to see the place.</p>
          <p className={styles.resultsNote}>Bring along: {props.plan.dressCode}</p>
        </>}
      </section>}
      <p className={styles.srOnly} role="status" aria-live="polite">{props.plan && !props.running ? `Your plan is ready. ${props.plan.stops.length} stops. Open a stop to see the place.` : ''}</p>
    </main>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="place-name" onClose={() => setSelected(null)} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
    }}>
      {selected && selectedPhoto && <>
        <button className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close place details" autoFocus>×</button>
        <Image className={styles.placeImage} src={`/design/${selectedPhoto.file}`} alt={selectedPhoto.alt} width={960} height={600} sizes="(max-width: 640px) 100vw, 640px" />
        <div className={styles.placeCopy}>
          <p className={styles.placeTime}>{time(selected.startsAt)} – {time(selected.endsAt)}</p>
          <h2 id="place-name">{selected.venueName}</h2>
          <p className={styles.placeDescription}>{selected.description}</p>
          <p className={styles.placeAddress}>{selected.address}</p>
          {selected.sourceUrl && /^https?:\/\//i.test(selected.sourceUrl) && <a className={styles.placeLink} href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">View place <span aria-hidden="true">↗</span></a>}
          <p className={styles.imageNote}>Photograph is illustrative.</p>
        </div>
      </>}
    </dialog>
  </WondrShell>;
}
