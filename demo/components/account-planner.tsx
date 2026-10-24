'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { exampleProfile } from '@/lib/agent/example-profile';
import type { PlanRow } from '@/lib/types';
import MysteryReady from './mystery-ready';
import DayTimeline from './day-timeline';

export default function AccountPlanner({ planId, startReady = false }: { planId: string; startReady?: boolean }) {
  const [showReady, setShowReady] = useState(startReady);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const client = supabaseBrowser();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const { data, error } = await client.from('plans').select('*').eq('id', planId).single();
      if (disposed) return;
      if (error) { setError('Could not load this day. Please reload to try again.'); return; }
      setPlan(data as PlanRow);
      if (data.status === 'planning') timer = setTimeout(refresh, 2000);
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); };
  }, [planId]);

  function changeScreen(ready: boolean) {
    const url = new URL(window.location.href);
    if (ready) url.searchParams.set('ready', '1'); else url.searchParams.delete('ready');
    window.history.replaceState(null, '', url);
    setShowReady(ready);
  }
  const newDay = () => { window.location.href = '/'; };
  if (showReady || !plan?.result || plan.status !== 'ready') return <MysteryReady
    plan={plan?.status === 'ready' ? plan.result : null} profile={plan?.input || exampleProfile()}
    progress={plan?.progress.at(-1)?.message} error={error || (plan?.status === 'failed' ? plan.error || 'Could not finish your day.' : '')}
    onBack={newDay} onStart={() => changeScreen(false)} />;

  return <DayTimeline plan={plan.result} profile={plan.input} onBack={() => changeScreen(true)} onNewDay={newDay} />;
}
