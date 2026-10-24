'use client';

import { useEffect, useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import { defaultPreferences, PreferencesSchema, preferencesToInput, type Preferences } from '@/lib/preferences';
import PlannerView from '@/components/planner-view';
import Onboarding from '@/components/onboarding';
import MysteryReady from '@/components/mystery-ready';

export default function CloudTest({ profile }: { profile: PlanInput }) {
  const [phase, setPhase] = useState<'onboarding' | 'ready' | 'planner'>('onboarding');
  const [initial, setInitial] = useState<Preferences | null>(null);
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [resultProfile, setResultProfile] = useState(profile);
  const [error, setError] = useState('');

  useEffect(() => {
    let saved = defaultPreferences('Joao');
    try {
      const parsed = PreferencesSchema.safeParse(JSON.parse(localStorage.getItem('wondr-preview-preferences') || 'null'));
      if (parsed.success) saved = { ...parsed.data, date: parsed.data.date < saved.date ? saved.date : parsed.data.date };
    } catch { /* Optional browser memory in the protected preview. */ }
    setInitial(saved);
  }, []);

  async function generate(input: PlanInput) {
    if (running) return;
    setRunning(true); setError(''); setPlan(null); setResultProfile(input); setPhase('ready');
    try {
      const response = await fetch('/api/cloud-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The request ended before a plan was returned. Please try again.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate the plan');
      setPlan(data.plan);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not generate the plan'); }
    finally { setRunning(false); }
  }

  if (!initial) return null;
  if (phase === 'onboarding') return <Onboarding initial={initial} storageKey="wondr-preview-draft"
    onSave={async (preferences) => {
      setInitial(preferences);
      try { localStorage.setItem('wondr-preview-preferences', JSON.stringify(preferences)); } catch { /* No account is used in this preview. */ }
    }} onGenerate={async (preferences) => { await generate(preferencesToInput(preferences, 'joao@example.com')); }} />;
  if (phase === 'ready') return <MysteryReady plan={plan} profile={resultProfile} progress="Your agent is researching your day. This can take a few minutes."
    error={error} onStart={() => setPhase('planner')} onBack={() => setPhase('onboarding')} />;
  return <PlannerView profile={resultProfile} resultProfile={resultProfile} account={<span>{resultProfile.organizer?.name || 'Joao'}</span>}
    onGenerate={generate} running={running} plan={plan} error={error}
    note={`Made for ${resultProfile.organizer?.name || 'you'} · ${resultProfile.interests.join(', ')}.`} />;
}
