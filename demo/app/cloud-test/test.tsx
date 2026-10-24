'use client';

import { useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import { defaultPreferences, preferencesToInput } from '@/lib/preferences';
import DayTimeline from '@/components/day-timeline';
import Onboarding from '@/components/onboarding';
import MysteryReady from '@/components/mystery-ready';

export default function CloudTest({ profile }: { profile: PlanInput }) {
  const [phase, setPhase] = useState<'onboarding' | 'ready' | 'timeline'>('onboarding');
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [resultProfile, setResultProfile] = useState(profile);
  const [error, setError] = useState('');

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

  const newDay = () => setPhase('onboarding');
  if (phase === 'onboarding') return <Onboarding initial={defaultPreferences()}
    onSave={async () => { /* The preview uses the answers directly, without an account. */ }}
    onGenerate={async (preferences) => { await generate(preferencesToInput(preferences, 'joao@example.com')); }} />;
  if (phase === 'ready' || !plan) return <MysteryReady plan={plan} profile={resultProfile} progress="Your agent is researching your day. This can take a few minutes."
    error={error} onStart={() => setPhase('timeline')} onBack={newDay} />;
  return <DayTimeline plan={plan} profile={resultProfile} onBack={() => setPhase('ready')} onNewDay={newDay} />;
}
