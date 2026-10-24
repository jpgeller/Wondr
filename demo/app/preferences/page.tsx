'use client';

// Onboarding: what the user likes, so every plan fits them. Three steps, saved to the
// `profiles` row (row-level security lets each user write only their own row). The agent
// merges this profile into every plan (lib/agent/profile.ts).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

const ACTIVITIES = ['Running', 'Yoga', 'Brunch', 'Dancing', 'Museums', 'Live music', 'Pottery', 'Hiking', 'Karaoke', 'Wine', 'Chess', 'Coffee'];
const DIETARY = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal'];
const ENERGY = ['Chill', 'Balanced', 'High energy'];

const ink = '#0F1B3D';
const orange = '#FF8A34';

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-4 py-2 text-sm font-semibold transition"
      style={on ? { background: ink, color: 'white', borderColor: ink } : { background: 'white', color: ink, borderColor: '#E7DCCB' }}
    >
      {label}
    </button>
  );
}

function Label({ children, value }: { children: React.ReactNode; value?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <span className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: '#5B6478' }}>{children}</span>
      {value && <span className="font-bold" style={{ color: ink }}>{value}</span>}
    </div>
  );
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

  return (
    <main className="min-h-screen" style={{ background: '#FFF6EA', color: ink }}>
      <div className="mx-auto max-w-md px-5 py-6 flex min-h-screen flex-col">
        <header className="flex items-center justify-between">
          <span className="text-2xl font-extrabold tracking-tight">
            w<span style={{ color: orange }}>●</span>ndr
          </span>
          <button className="text-sm" style={{ color: '#5B6478' }} onClick={() => (step ? setStep(step - 1) : router.push('/'))}>
            Back
          </button>
        </header>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1.5 rounded-full" style={{ background: i <= step ? orange : '#EFE4D3' }} />
          ))}
        </div>

        <section className="mt-8 flex-1">
          {step === 0 && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">Where do your days start?</h1>
              <div className="mt-8 space-y-6">
                <div>
                  <Label>Neighborhood or city</Label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-2xl border bg-white px-4 py-3 font-semibold outline-none"
                    style={{ borderColor: '#E7DCCB' }}
                  />
                </div>
                <div>
                  <Label>Usually free</Label>
                  <div className="flex items-center gap-3">
                    <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="flex-1 rounded-2xl border bg-white px-4 py-3 font-semibold" style={{ borderColor: '#E7DCCB' }} />
                    <span>to</span>
                    <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="flex-1 rounded-2xl border bg-white px-4 py-3 font-semibold" style={{ borderColor: '#E7DCCB' }} />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">What lights you up?</h1>
              <div className="mt-8">
                <Label>Love</Label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map((a) => (
                    <Pill key={a} label={a} on={love.includes(a)} onClick={() => { toggle(love, setLove, a); setPass(pass.filter((x) => x !== a)); }} />
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <Label>Hard pass</Label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map((a) => (
                    <Pill key={a} label={a} on={pass.includes(a)} onClick={() => { toggle(pass, setPass, a); setLove(love.filter((x) => x !== a)); }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">The practical bits</h1>
              <div className="mt-8 space-y-8">
                <div>
                  <Label>Dietary</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY.map((d) => <Pill key={d} label={d} on={dietary.includes(d)} onClick={() => toggleDiet(d)} />)}
                  </div>
                </div>
                <div>
                  <Label value={`$${budget}`}>Budget per person</Label>
                  <input type="range" min={0} max={300} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full" style={{ accentColor: orange }} />
                </div>
                <div>
                  <Label value={ENERGY[energy]}>Energy level</Label>
                  <input type="range" min={0} max={2} step={1} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full" style={{ accentColor: orange }} />
                </div>
                <div>
                  <Label value={`${travel} mi`}>Max travel</Label>
                  <input type="range" min={1} max={20} step={1} value={travel} onChange={(e) => setTravel(Number(e.target.value))} className="w-full" style={{ accentColor: orange }} />
                </div>
              </div>
            </>
          )}
          {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        </section>

        <footer className="mt-8 flex gap-3 pb-2">
          <button
            className="rounded-full border px-7 py-4 font-bold"
            style={{ borderColor: '#E7DCCB' }}
            onClick={() => (step ? setStep(step - 1) : router.push('/'))}
          >
            Back
          </button>
          <button
            disabled={!canContinue || saving || !userId}
            className="flex-1 rounded-full py-4 font-bold shadow-lg disabled:opacity-50"
            style={{ background: orange, color: ink }}
            onClick={() => (step < 2 ? setStep(step + 1) : save())}
          >
            {step < 2 ? 'Continue' : saving ? 'Saving…' : 'Save my taste'}
          </button>
        </footer>
      </div>
    </main>
  );
}
