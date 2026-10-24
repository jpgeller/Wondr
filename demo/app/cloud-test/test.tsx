'use client';

import { useState } from 'react';
import type { Plan, PlanInput } from '@/lib/types';
import PlannerView from '@/components/planner-view';

export default function CloudTest({ profile }: { profile: PlanInput }) {
  const [running, setRunning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [resultProfile, setResultProfile] = useState(profile);
  const [error, setError] = useState('');

  async function generate(input: PlanInput) {
    if (running) return;
    setRunning(true); setError(''); setPlan(null); setResultProfile(input);
    try {
      const response = await fetch('/api/cloud-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
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

  return <PlannerView profile={profile} resultProfile={resultProfile} account={<span>Joao</span>}
    onGenerate={generate} running={running} plan={plan} error={error}
    note="Made for Joao · Chess, running, and new restaurants." />;
}
