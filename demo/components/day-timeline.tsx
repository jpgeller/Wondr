'use client';

import { useEffect, useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import OnboardingLogo from './onboarding-brand';
import PlacePhoto from './place-photo';
import { stopSummary } from '@/lib/stop-summary';
import styles from './onboarding.module.css';

export default function DayTimeline({ plan, profile, onBack, onNewDay }: {
  plan: Plan; profile: PlanInput; onBack: () => void; onNewDay: () => void;
}) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const timezone = profile.timezone || 'America/Los_Angeles';
  const time = (value: string) => new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: timezone,
  });
  const date = new Date(`${plan.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

  return <div className={`${styles.page} ${styles.illustrated} ${styles.resultsPage}`}>
    <main className={`${styles.column} ${styles.dayPanel}`}>
      <header className={styles.header}><OnboardingLogo /><button className={styles.textButton} onClick={onBack}>Back</button></header>
      <div className={styles.dayHeading}>
        <div><p className={styles.dayEyebrow}>Live day</p><h1 className={styles.heading}>Stop {active + 1} of {plan.stops.length}</h1></div>
      </div>
      <p className={styles.dayMeta}>{date} · {profile.city}</p>
      <p className={styles.dayHint}>A little mystery, one stop at a time.<br />Tap any stop to reveal it early.</p>
      <ol className={styles.timeline} aria-label="Your mystery stops">
        {plan.stops.map((stop, index) => {
          const open = revealed.includes(stop.position);
          const travel = index > 0 ? stop.travelFromPrevious : undefined;
          const ticketUrl = stop.admission?.ticketUrl || stop.booking.bookingUrl || stop.sourceUrl;
          const ticketed = stop.admission?.kind === 'ticket' && !/restaurant|food|dining|cafe|bar/i.test(stop.category);
          return <li key={stop.position} className={styles.timelineItem} data-active={active === index}>
            {travel && <p className={styles.travelLeg}>{travel.mode === 'walking' ? 'Walk' : 'Drive'} · ~{travel.minutes} min · {travel.distanceMiles.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi <span>Estimated</span></p>}
            <span className={styles.stopMarker} aria-hidden="true">{open ? '✓' : active === index ? '?' : <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>}</span>
            <div className={styles.stopCard}>
              <button className={styles.stopButton} aria-expanded={open} aria-controls={`stop-${stop.position}`}
                aria-label={`${open ? 'Hide' : 'Reveal'} stop ${stop.position}, ${time(stop.startsAt)}`}
                onClick={() => { setActive(index); setRevealed((previous) => open ? previous.filter((position) => position !== stop.position) : [...previous, stop.position]); }}>
                <span className={styles.stopTime}><time dateTime={stop.startsAt}>{time(stop.startsAt)}</time> – <time dateTime={stop.endsAt}>{time(stop.endsAt)}</time></span>
                <span className={styles.stopTitle}>{open ? stop.venueName : `Mystery stop ${stop.position}`}</span>
                <span className={styles.revealHint}>{open ? 'Hide the surprise' : 'Tap to reveal'}<span aria-hidden="true">{open ? '−' : '+'}</span></span>
              </button>
              {open && <section id={`stop-${stop.position}`} className={styles.stopDetails} aria-label={`Stop ${stop.position} details`}>
                <PlacePhoto venueName={stop.venueName} address={stop.address} placeId={stop.googlePlaceId} />
                <p className={styles.stopSummary}>{stopSummary(stop.description)}</p>
                <a className={styles.stopAddress} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.venueName}, ${stop.address}`)}`} target="_blank" rel="noreferrer">{stop.address} ↗</a>
                {ticketed && <details className={styles.ticket}>
                  <summary><span>✓ Purchased ticket <small>Preview</small></span><span>View ticket</span></summary>
                  <div className={styles.ticketBody}><strong>{stop.venueName}</strong><p>{date} · {time(stop.startsAt)}</p>
                    {stop.admission?.priceUsd !== undefined && <p>${stop.admission.priceUsd} per person</p>}
                    <p>Ticket preview only. No payment or booking has been made.</p>
                    {ticketUrl && /^https?:\/\//i.test(ticketUrl) && <a href={ticketUrl} target="_blank" rel="noreferrer">{stop.admission?.ticketUrl ? 'Ticket website' : 'Venue & ticket details'} ↗</a>}
                  </div>
                </details>}
                <div className={styles.stopLinks}>
                  {ticketed && ticketUrl && /^https?:\/\//i.test(ticketUrl) && <a href={ticketUrl} target="_blank" rel="noreferrer">{stop.admission?.ticketUrl ? 'Tickets' : 'Ticket details'} ↗</a>}
                  {(!ticketed || ticketUrl !== stop.sourceUrl) && stop.sourceUrl && /^https?:\/\//i.test(stop.sourceUrl) && <a href={stop.sourceUrl} target="_blank" rel="noreferrer">Visit website ↗</a>}</div>
              </section>}
            </div>
          </li>;
        })}
      </ol>
      <p className={styles.timezoneNote}>Times in {timezone.replaceAll('_', ' ').split('/').at(-1)}.</p>
      <div className={styles.newDay}><button className={styles.primary} onClick={onNewDay}>Plan another day</button><p>New day, new answers, new possibilities.</p></div>
    </main>
  </div>;
}
