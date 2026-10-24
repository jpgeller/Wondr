// Runs before every page request and keeps the Supabase login session fresh (the
// standard @supabase/ssr pattern). Pages that need a user check currentUser() themselves.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie if it expired. Do not remove.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static files, images and the agent API (it checks auth itself).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/plan|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
