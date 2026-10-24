// Who is calling an agent route. Reads the Supabase session cookie, or an
// `Authorization: Bearer <access token>` header (handy for curl). Route handlers only.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb } from './db';

export async function currentUserId(req: Request): Promise<string | null> {
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (bearer) {
    const { data } = await adminDb().auth.getUser(bearer);
    return data.user?.id ?? null;
  }

  const store = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {}, // route handlers here never refresh the session
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
