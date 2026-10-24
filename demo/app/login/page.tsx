'use client';

// Sign in with Google. The same consent screen also asks for calendar access, so nobody
// has to consent twice (spec section 8). access_type=offline + prompt=consent make Google
// return a refresh token, which /auth/callback saves.

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /auth/callback sends failed logins back here with ?error=...
  useEffect(() => {
    setError(new URLSearchParams(window.location.search).get('error'));
  }, []);

  async function signIn() {
    setLoading(true);
    setError(null);
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser is already on its way to Google.
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight">WONDR</h1>
        <p className="text-lg text-neutral-500 max-w-sm">
          Tell us when you are free. We plan a mystery day and reveal it one stop at a time.
        </p>
      </div>
      <button
        onClick={signIn}
        disabled={loading}
        className="rounded-full bg-black text-white dark:bg-white dark:text-black px-6 py-3 font-medium disabled:opacity-50"
      >
        {loading ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <p className="text-xs text-neutral-500 max-w-xs">
        We ask for calendar access so we can add your mystery stops to your calendar.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
