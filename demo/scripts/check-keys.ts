// One cheap call per external service, so we know every key works before building on it.
//
//   npx tsx --env-file=.env.local scripts/check-keys.ts
//
// Prints OK / FAIL / SKIP per service. Sends no email and books nothing.

import { z } from 'zod';
import { generateJSON } from '../lib/llm';
import { geocode, getVenueDetails, searchVenues } from '../lib/agent/tools';
import { adminDb } from '../lib/agent/db';

type Check = [name: string, needs: string[], run: () => Promise<string>];

const checks: Check[] = [
  [
    `Model (${process.env.LLM_PROVIDER || 'omnara'})`,
    process.env.LLM_PROVIDER === 'anthropic' ? ['ANTHROPIC_API_KEY'] : ['OMNARA_API_KEY', 'OMNARA_BASE_URL'],
    async () => {
      const r = await generateJSON({
        name: 'check',
        system: 'You answer with JSON only.',
        prompt: 'Name one park in San Francisco.',
        schema: z.object({ park: z.string() }),
        maxTokens: 2000,
      });
      return r.park;
    },
  ],
  [
    'Exa search',
    ['EXA_API_KEY'],
    async () => {
      const r = await searchVenues('climbing gym San Francisco', 2);
      if (!r.length) throw new Error('no results');
      return r.map((x) => x.url).join(', ');
    },
  ],
  [
    'context.dev scrape',
    ['CONTEXT_DEV_API_KEY'],
    async () => {
      const md = await getVenueDetails('https://www.sfmoma.org/visit/', 500);
      if (!md) throw new Error('no markdown returned (bad key or no credits?)');
      return `${md.length} chars: ${md.slice(0, 60).replace(/\s+/g, ' ')}…`;
    },
  ],
  [
    'Geocoder (OpenStreetMap)',
    [],
    async () => {
      const p = await geocode('151 3rd St, San Francisco, CA');
      if (!p) throw new Error('no result');
      return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    },
  ],
  [
    'Supabase plans table',
    ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
        throw new Error(`NEXT_PUBLIC_SUPABASE_URL should look like https://<project>.supabase.co with nothing after it`);
      // A plain select, not a head request: head requests swallow a 404 and look like success.
      const { error } = await adminDb().from('plans').select('id').limit(1);
      if (error) throw new Error(error.message);
      for (const table of ['profiles', 'google_tokens']) {
        const r = await adminDb().from(table).select('user_id').limit(1);
        if (r.error) throw new Error(`${table}: ${r.error.message}`);
      }
      return 'profiles, plans, google_tokens reachable';
    },
  ],
  [
    'Supabase Google sign-in',
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      });
      const settings = await res.json();
      if (!settings?.external?.google) throw new Error('Google provider is not enabled in Supabase Authentication');
      return 'enabled';
    },
  ],
  [
    'Resend (config only, nothing sent)',
    ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
    async () => `from ${process.env.RESEND_FROM_EMAIL}, dry run ${process.env.BOOKING_DRY_RUN !== 'false' ? 'on' : 'OFF'}`,
  ],
];

async function main() {
  let failed = 0;
  for (const [name, needs, run] of checks) {
    const missing = needs.filter((k) => !process.env[k]);
    if (missing.length) {
      console.log(`SKIP  ${name}: missing ${missing.join(', ')}`);
      continue;
    }
    try {
      console.log(`OK    ${name}: ${await run()}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
