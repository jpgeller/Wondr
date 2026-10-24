'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { PreferencesSchema, type Preferences } from '@/lib/preferences';
import OnboardingLogo from './onboarding-brand';
import styles from './onboarding.module.css';

const ACTIVITIES = ['Running', 'Yoga', 'Brunch', 'Dancing', 'Museums', 'Live music', 'Pottery', 'Hiking', 'Karaoke', 'Wine', 'Chess', 'Coffee'];
const DIETARY = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal'];
const ENERGY = ['Chill', 'Balanced', 'High energy'] as const;
const VIBES = ['Adventurous', 'Cozy', 'Romantic', 'Social', 'Creative'] as const;

function Pills({ label, items, selected, onToggle }: { label: string; items: readonly string[]; selected: string[]; onToggle: (item: string) => void }) {
  return <fieldset className={styles.group}><legend className={styles.legend}>{label}</legend>
    <div className={styles.pills}>{items.map((item) => <button key={item} type="button" className={styles.pill}
      aria-pressed={selected.includes(item)} data-selected={selected.includes(item)} onClick={() => onToggle(item)}>{item}</button>)}</div>
  </fieldset>;
}

function Slider({ id, label, value, min, max, step = 1, display, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (value: number) => void;
}) {
  return <div className={styles.group}><div className={styles.label}><label htmlFor={id}>{label}</label><output htmlFor={id}>{display}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={display}
      className={styles.range} style={{ '--fill': `${100 * (value - min) / (max - min)}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))} />
  </div>;
}

export default function Onboarding({ initial, storageKey, editing = false, onSave, onGenerate }: {
  initial: Preferences; storageKey: string; editing?: boolean;
  onSave: (preferences: Preferences) => Promise<void>;
  onGenerate: (preferences: Preferences) => Promise<void>;
}) {
  const [answers, setAnswers] = useState(initial);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [friend, setFriend] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const patch = (values: Partial<Preferences>) => setAnswers((previous) => ({ ...previous, ...values }));

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
      // Drafts can be incomplete while the name/interests steps are in progress.
      const valid = PreferencesSchema.safeParse({ ...draft?.answers, name: draft?.answers?.name || 'You', interests: draft?.answers?.interests?.length ? draft.answers.interests : ['Coffee'] });
      if (draft?.answers && valid.success) {
        setAnswers({ ...valid.data, name: draft.answers.name || '', interests: draft.answers.interests || [], date: valid.data.date < initial.date ? initial.date : valid.data.date });
        if (!editing && Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= 4) setStep(draft.step);
      }
    } catch { /* Private browsing can disable local storage; account saving still works. */ }
    setLoaded(true);
  }, [storageKey, editing, initial.date]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ answers, step })); } catch { /* Account saving is independent of drafts. */ }
  }, [answers, step, storageKey, loaded]);

  useEffect(() => { heading.current?.focus(); }, [step]);

  function back() { if (!busy) { setError(''); setStep(Math.max(0, step - 1)); } }
  function toggleActivity(item: string, field: 'interests' | 'dislikes') {
    const other = field === 'interests' ? 'dislikes' : 'interests';
    patch({ [field]: answers[field].includes(item) ? answers[field].filter((value) => value !== item) : [...answers[field], item],
      [other]: answers[other].filter((value) => value !== item) });
  }
  function addFriend() {
    const email = friend.trim().toLowerCase();
    if (!email) return;
    if (!PreferencesSchema.shape.friendEmails.element.safeParse(email).success) { setError('Enter a valid email address.'); return; }
    if (answers.friendEmails.length >= 20) { setError('You can add up to 20 friends.'); return; }
    patch({ friendEmails: [...new Set([...answers.friendEmails, email])] }); setFriend(''); setError('');
  }

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setError('');
    // Read native inputs from the form so date/time values always match the display.
    const data = new FormData(event.currentTarget);
    const next = { ...answers };
    if (step === 1) { next.name = String(data.get('name')).trim(); next.city = String(data.get('city')).trim(); }
    if (step === 4) {
      for (const key of ['date', 'windowStart', 'windowEnd', 'city', 'timezone'] as const) next[key] = String(data.get(key));
      if (friend.trim()) { setError('Click Add next to your friend’s email, or clear it to continue.'); return; }
    }
    patch(next);
    if (step === 2 && !next.interests.length) { setError('Pick at least one thing you love.'); return; }
    if (step < 3) { setStep(step + 1); return; }
    const parsed = PreferencesSchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check your answers.'); return; }
    setBusy(true);
    try {
      await onSave(parsed.data);
      if (step === 3) setStep(4);
      else {
        await onGenerate(parsed.data);
        try { localStorage.removeItem(storageKey); } catch { /* Optional local draft. */ }
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your answers. Please try again.'); }
    finally { setBusy(false); }
  }

  if (step === 0) return <div className={`${styles.page} ${styles.dark}`}><main className={`${styles.column} ${styles.welcome}`}>
    <OnboardingLogo large />
    <h1 className={styles.heading} ref={heading} tabIndex={-1}>Stop searching.<br />Start wondering.</h1>
    <p className={styles.intro}>Tell us when you’re free. Your agent finds a real day out, shaped around you. Discover each stop as you go.</p>
    <ol className={styles.how}><li><span>1</span>Share your vibe</li><li><span>2</span>Your agent plans the day</li><li><span>3</span>Uncover your stops, one by one</li></ol>
    <button className={styles.primary} disabled={!loaded} onClick={() => setStep(1)}>Get started</button>
    <p className={styles.tagline}>Wonder first. Wander next.</p>
  </main></div>;

  return <div className={styles.page}><main className={styles.column}>
    <header className={styles.header}><OnboardingLogo /><button type="button" className={styles.textButton} disabled={busy} onClick={back}>Back</button></header>
    <div className={styles.steps} role="progressbar" aria-label="Your preferences" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step} aria-valuetext={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((value) => <span key={value} data-complete={value <= step} />)}
    </div>
    <form className={styles.form} onSubmit={next} key={step} aria-busy={busy}>
      <h1 className={styles.heading} ref={heading} tabIndex={-1}>{['', 'First, a little about you.', 'What lights you up?', 'The practical bits', 'Plan a mystery day'][step]}</h1>
      <p className={styles.intro}>{['', 'Every good day starts with you.', 'More of what you love. Skip what you don’t.', 'Good surprises should still fit your life.', 'You choose the frame. We fill in the wonder.'][step]}</p>
      {step === 1 && <>
        <div className={styles.group}><div className={styles.label}><label htmlFor="name">What should we call you?</label></div><input className={styles.input} id="name" name="name" autoComplete="given-name" placeholder="Your name" maxLength={100} required defaultValue={answers.name} onInput={(e) => patch({ name: e.currentTarget.value })} /></div>
        <div className={styles.group}><div className={styles.label}><label htmlFor="city">Your neighborhood or city</label></div><input className={styles.input} id="city" name="city" autoComplete="address-level2" maxLength={200} required defaultValue={answers.city} onInput={(e) => patch({ city: e.currentTarget.value })} /></div>
        <p className={styles.hint}>We’ll remember your taste for next time. You can change any answer later.</p>
      </>}
      {step === 2 && <>
        <Pills label="Love" items={[...new Set([...ACTIVITIES, ...answers.interests, ...answers.dislikes])]} selected={answers.interests} onToggle={(item) => toggleActivity(item, 'interests')} />
        <Pills label="Hard pass" items={[...new Set([...ACTIVITIES, ...answers.interests, ...answers.dislikes])]} selected={answers.dislikes} onToggle={(item) => toggleActivity(item, 'dislikes')} />
      </>}
      {step === 3 && <>
        <Pills label="Dietary" items={DIETARY} selected={answers.dietary.length ? answers.dietary : ['None']} onToggle={(item) => patch({ dietary: item === 'None' ? [] : answers.dietary.includes(item) ? answers.dietary.filter((d) => d !== item) : [...answers.dietary, item] })} />
        <Slider id="budget" label="Budget per person" value={answers.budget} min={0} max={300} step={10} display={`$${answers.budget}`} onChange={(budget) => patch({ budget, budgetCap: budget })} />
        <Slider id="energy" label="Energy level" value={ENERGY.indexOf(answers.energy)} min={0} max={2} display={answers.energy} onChange={(energy) => patch({ energy: ENERGY[energy] })} />
        <Slider id="travel" label="Max travel" value={answers.travel} min={1} max={20} display={`${answers.travel} mi`} onChange={(travel) => patch({ travel })} />
      </>}
      {step === 4 && <>
        <div className={styles.group}><div className={styles.label}><label htmlFor="date">When</label></div><input className={styles.input} type="date" id="date" name="date" required defaultValue={answers.date} onInput={(e) => patch({ date: e.currentTarget.value })} />
          <div className={styles.times}><div><label className={styles.smallLabel} htmlFor="start">From</label><input className={styles.input} id="start" name="windowStart" type="time" required defaultValue={answers.windowStart} onInput={(e) => patch({ windowStart: e.currentTarget.value })} /></div><div><label className={styles.smallLabel} htmlFor="end">Until</label><input className={styles.input} id="end" name="windowEnd" type="time" required defaultValue={answers.windowEnd} onInput={(e) => patch({ windowEnd: e.currentTarget.value })} /></div></div>
        </div>
        <div className={styles.group}><div className={styles.label}><label htmlFor="where">Where</label></div><input className={styles.input} name="city" id="where" required maxLength={200} defaultValue={answers.city} onInput={(e) => patch({ city: e.currentTarget.value })} /></div>
        <div className={styles.group}><div className={styles.label}><label htmlFor="timezone">Local time zone</label></div><select className={styles.input} name="timezone" id="timezone" defaultValue={answers.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
          {[...new Set([answers.timezone, 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Lisbon', 'Europe/Copenhagen', Intl.DateTimeFormat().resolvedOptions().timeZone])].map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ').replaceAll('/', ' / ')}</option>)}
        </select></div>
        <Pills label="Vibe" items={VIBES} selected={[answers.vibe]} onToggle={(vibe) => patch({ vibe: vibe as Preferences['vibe'] })} />
        <Slider id="cap" label="Budget cap per person" value={answers.budgetCap} min={0} max={300} step={10} display={`$${answers.budgetCap}`} onChange={(budgetCap) => patch({ budgetCap })} />
        <div className={styles.group}><div className={styles.label}><label htmlFor="friend">Who’s coming</label></div>
          <div className={styles.friendRow}><input id="friend" className={styles.input} inputMode="email" autoComplete="off" placeholder="friend@email.com" value={friend} onChange={(e) => setFriend(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFriend(); } }} /><button type="button" className={styles.add} onClick={addFriend}>Add</button></div>
          <div className={styles.friends}>{answers.friendEmails.map((email) => <button type="button" key={email} className={styles.pill} aria-label={`Remove ${email}`} onClick={() => patch({ friendEmails: answers.friendEmails.filter((f) => f !== email) })}>{email} ×</button>)}</div>
          <p className={styles.hint}>Leave empty for a solo day. Added friends receive calendar invites when your connected calendar is updated.</p>
        </div>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button type="button" className={styles.back} disabled={busy} onClick={back}>Back</button><button type="submit" className={styles.primary} disabled={busy || !loaded}>{busy ? (step === 4 ? 'Starting your day…' : 'Saving…') : step === 4 ? 'Plan my mystery day' : step === 3 ? 'Save my taste' : 'Continue'}</button></div>
    </form>
  </main></div>;
}
