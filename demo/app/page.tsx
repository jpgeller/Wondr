// Home. Signed out: go to /login. Signed in: who you are and whether the calendar is
// connected. Placeholder until the profile, plan and timeline screens exist.

import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { data: token } = await db().from('google_tokens').select('user_id').eq('user_id', user.id).maybeSingle();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">WONDR</h1>
      <p className="text-lg">
        Signed in as <strong>{user.user_metadata?.full_name ?? user.email}</strong>
      </p>
      <p className={token ? 'text-green-600' : 'text-amber-600'}>
        {token ? 'Google Calendar connected' : 'Google Calendar not connected. Sign out and in again to connect it.'}
      </p>
      <form action="/auth/signout" method="post">
        <button className="rounded-full border px-5 py-2 text-sm">Sign out</button>
      </form>
    </main>
  );
}
