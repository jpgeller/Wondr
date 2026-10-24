'use client';

// Sign in with Google. The same consent screen also asks for calendar access, so nobody
// has to consent twice (spec section 8). access_type=offline + prompt=consent make Google
// return a refresh token, which /auth/callback saves.

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import WondrShell from '@/components/wondr-shell';
import styles from '@/components/planner.module.css';

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

  return <WondrShell skipTo="sign-in">
    <main className={styles.main}>
      <section id="sign-in" className={styles.planner}>
        <h1>Stop searching.<br />Start wondering.</h1>
        <p className={styles.intro}>A mystery day, made for you.<br />Choose when and where. Leave the rest open.</p>
        <div className={styles.loginAction}><button
        onClick={signIn}
        disabled={loading}
        className={styles.generate}
      >
        {loading ? 'Opening Google…' : 'Continue with Google'}<span aria-hidden="true">↗</span>
      </button></div>
      <p className={styles.note}>
        We ask for calendar access so we can add your mystery stops to your calendar.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
  </WondrShell>;
}
