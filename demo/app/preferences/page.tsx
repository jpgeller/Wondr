'use client';

// Onboarding: what the user likes, so every plan fits them. Three steps, saved to the
// `profiles` row (row-level security lets each user write only their own row). The agent
// merges this profile into every plan (lib/agent/profile.ts).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import WondrShell from '@/components/wondr-shell';
import styles from '@/components/planner.module.css';

const ACTIVITIES = ['Running', 'Yoga', 'Brunch', 'Dancing', 'Museums', 'Live music', 'Pottery', 'Hiking', 'Karaoke', 'Wine', 'Chess', 'Coffee'];
const DIETARY = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal'];
const ENERGY = ['Chill', 'Balanced', 'High energy'];

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={styles.pill} data-selected={on}>{label}</button>;
}

function Label({ children, value, htmlFor }: { children: React.ReactNode; value?: string; htmlFor?: string }) {
  return <div className={styles.preferenceLabel}>
    {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>}
    {value && <span>{value}</span>}
  </div>;
}

export default function Preferences() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [city, setCity] = useState('Mission District, San Francisco');
  const [windowStart, setWindowStart] = useState('10:00');
  const [windowEnd, setWindowEnd] = useState('18:00');
  const [love, setLove] = useState<string[]>([]);
  const [pass, setPass] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>(['None']);
  const [budget, setBudget] = useState(80);
  const [energy, setEnergy] = useState(1);
  const [travel, setTravel] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace('/login?next=%2Fpreferences');
      setUserId(data.user.id);
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
      if (!p) return;
      if (p.city) setCity(p.city);
      if (p.default_window_start) setWindowStart(p.default_window_start);
      if (p.default_window_end) setWindowEnd(p.default_window_end);
      if (p.interests?.length) setLove(p.interests);
      if (p.dislikes?.length) setPass(p.dislikes);
      if (p.dietary?.length) setDietary(p.dietary);
      if (p.default_budget) setBudget(p.default_budget);
      if (p.energy_level) setEnergy(Math.max(0, ENERGY.indexOf(p.energy_level)));
      if (p.max_travel_miles) setTravel(p.max_travel_miles);
    });
  }, [router]);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const toggleDiet = (item: string) => {
    if (item === 'None') return setDietary(['None']);
    const next = dietary.filter((d) => d !== 'None');
    setDietary(next.includes(item) ? (next.length === 1 ? ['None'] : next.filter((d) => d !== item)) : [...next, item]);
  };

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city,
        default_window_start: windowStart,
        default_window_end: windowEnd,
        interests: love,
        dislikes: pass,
        dietary: dietary.filter((d) => d !== 'None'),
        default_budget: budget,
        energy_level: ENERGY[energy],
        max_travel_miles: travel,
      }),
    });
    setSaving(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? 'Could not save, try again');
    router.push('/agent-test');
  }

  const canContinue = step === 0 ? city.trim().length > 0 && windowEnd > windowStart : step === 1 ? love.length > 0 : true;

  return <WondrShell skipTo="preferences" account={<button onClick={() => (step ? setStep(step - 1) : router.push('/'))}>Back</button>}>
    <main className={styles.preferencesMain}>
      <section id="preferences" className={styles.preferences} aria-labelledby="preferences-title">
        <div className={styles.steps} aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => <span key={i} data-complete={i <= step} />)}
        </div>
        {step === 0 && <>
          <h1 id="preferences-title">Where do your days start?</h1>
          <p className={styles.intro}>A starting point and a little time to get lost.</p>
          <div className={styles.preferenceGroup}>
            <Label htmlFor="home-city">Neighborhood or city</Label>
            <input id="home-city" autoComplete="address-level2" maxLength={200} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className={styles.timeFields}>
            <div className={styles.preferenceGroup}><Label htmlFor="usual-start">Usually free from</Label><input id="usual-start" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></div>
            <div className={styles.preferenceGroup}><Label htmlFor="usual-end">Until</Label><input id="usual-end" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} /></div>
          </div>
        </>}
        {step === 1 && <>
          <h1 id="preferences-title">What lights you up?</h1>
          <p className={styles.intro}>More of what you love. Less of what you don’t.</p>
          <div className={styles.preferenceGroup}>
            <Label>Love</Label>
            <div className={styles.pills}>{ACTIVITIES.map((a) => <Pill key={a} label={a} on={love.includes(a)} onClick={() => { toggle(love, setLove, a); setPass(pass.filter((x) => x !== a)); }} />)}</div>
          </div>
          <div className={styles.preferenceGroup}>
            <Label>Hard pass</Label>
            <div className={styles.pills}>{ACTIVITIES.map((a) => <Pill key={a} label={a} on={pass.includes(a)} onClick={() => { toggle(pass, setPass, a); setLove(love.filter((x) => x !== a)); }} />)}</div>
          </div>
        </>}
        {step === 2 && <>
          <h1 id="preferences-title">The practical bits.</h1>
          <p className={styles.intro}>Good surprises still need to fit your day.</p>
          <div className={styles.preferenceGroup}>
            <Label>Dietary</Label>
            <div className={styles.pills}>{DIETARY.map((d) => <Pill key={d} label={d} on={dietary.includes(d)} onClick={() => toggleDiet(d)} />)}</div>
          </div>
          <div className={styles.preferenceGroup}><Label htmlFor="budget" value={`$${budget}`}>Budget per person</Label><input id="budget" type="range" min={0} max={300} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></div>
          <div className={styles.preferenceGroup}><Label htmlFor="energy" value={ENERGY[energy]}>Energy level</Label><input id="energy" type="range" min={0} max={2} step={1} value={energy} aria-valuetext={ENERGY[energy]} onChange={(e) => setEnergy(Number(e.target.value))} /></div>
          <div className={styles.preferenceGroup}><Label htmlFor="travel" value={`${travel} mi`}>Max travel</Label><input id="travel" type="range" min={1} max={20} step={1} value={travel} onChange={(e) => setTravel(Number(e.target.value))} /></div>
        </>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.preferenceActions}>
          {step > 0 && <button className={styles.backButton} onClick={() => setStep(step - 1)}>Back</button>}
          <button disabled={!canContinue || saving || !userId} className={styles.generate}
            onClick={() => (step < 2 ? setStep(step + 1) : save())}>
            {step < 2 ? 'Continue' : saving ? 'Saving…' : 'Save my taste'}<span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </main>
  </WondrShell>;
}
