import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { db } from '@/lib/supabase/admin';
import { savedPreferences } from '@/lib/preferences';
import AccountOnboarding from './account-onboarding';

export default async function OnboardingPage({ editing = false }: { editing?: boolean }) {
  const user = await currentUser();
  if (!user) redirect(editing ? '/login?next=%2Fpreferences' : '/login');
  const { data } = await db().from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  return <AccountOnboarding initial={savedPreferences(data, user.user_metadata)} userId={user.id} email={user.email!} editing={editing} />;
}
