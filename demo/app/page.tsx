import { redirect } from 'next/navigation';
import AccountPlanner from '@/components/account-planner';
import { db } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { data: token } = await db().from('google_tokens').select('user_id').eq('user_id', user.id).maybeSingle();
  const { data: profile } = await db().from('profiles').select('interests').eq('user_id', user.id).maybeSingle();
  if (!profile?.interests?.length) redirect('/preferences');

  return <AccountPlanner initialName={user.user_metadata?.full_name ?? user.email} calendarConnected={!!token} />;
}
