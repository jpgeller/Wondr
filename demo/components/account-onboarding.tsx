'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { preferencesToInput, type Preferences } from '@/lib/preferences';
import Onboarding from './onboarding';

export default function AccountOnboarding({ initial, userId, email, editing = false }: {
  initial: Preferences; userId: string; email: string; editing?: boolean;
}) {
  const router = useRouter();
  async function save(preferences: Preferences) {
    const response = await fetch('/api/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not save your answers.');
  }
  async function generate(preferences: Preferences) {
    const client = supabaseBrowser();
    const { data: auth } = await client.auth.getSession();
    if (!auth.session) throw new Error('Please sign in again to start your day.');
    const { data, error } = await client.from('plans').insert({
      user_id: userId, status: 'planning', input: preferencesToInput(preferences, email), progress: [],
    }).select('id').single();
    if (error) throw new Error(error.message);
    const response = await fetch('/api/plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}` },
      body: JSON.stringify({ planId: data.id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not start your day.');
    router.push(`/agent-test?plan=${encodeURIComponent(data.id)}&ready=1`);
  }
  return <Onboarding initial={initial} editing={editing} onSave={save} onGenerate={generate} />;
}
