import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { defaultPreferences } from '@/lib/preferences';
import AccountOnboarding from './account-onboarding';

export default async function OnboardingPage({ editing = false }: { editing?: boolean }) {
  const user = await currentUser();
  if (!user) redirect(editing ? '/login?next=%2Fpreferences' : '/login');
  // Each demo starts a new questionnaire, even on an account with saved answers.
  return <AccountOnboarding initial={defaultPreferences()} userId={user.id} email={user.email!} editing={editing} />;
}
