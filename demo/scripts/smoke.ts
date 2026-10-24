// End-to-end test of the planner with every external service faked (Exa, context.dev,
// the model, the geocoder). No keys, no network, about 15 s.
//
//   npx tsx scripts/smoke.ts
//
// Checks: a closed venue is rejected and replaced, travel pushes stops back, a stop that
// cannot be booked is swapped for a walk-in venue, re-plan works for all three reasons,
// timezone offsets survive DST, and every plan passes the schema.

import assert from 'node:assert/strict';
import { planDay, replanDay } from '../lib/agent';
import { seedPlan } from '../lib/agent/seed';
import { localToDate, toZonedISO } from '../lib/agent/time';
import { prefillBookingUrl } from '../lib/booking/link';
import type { PlanInput } from '../lib/types';

Object.assign(process.env, {
  LLM_PROVIDER: 'omnara',
  OMNARA_BASE_URL: 'https://fake.test',
  OMNARA_API_KEY: 'x',
  EXA_API_KEY: 'x',
  CONTEXT_DEV_API_KEY: 'x',
  BOOKING_DRY_RUN: 'true',
});

// ------------------------------------------------------------- fake world

let pick = 0;
let url = 0;
globalThis.fetch = (async (target: string | URL, init?: RequestInit) => {
  const u = String(target);
  const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
  if (u.includes('exa.ai'))
    return json({ results: [0, 1, 2, 3, 4].map(() => ({ url: `https://venue${url++}.test`, title: 't', text: 'Open daily 8am-11pm' })) });
  if (u.includes('context.dev')) return json({ markdown: { success: true, data: 'Hours: 8am to 11pm daily' } });
  if (u.includes('nominatim')) return json([{ lat: 37.76 + (pick % 5) * 0.004, lon: -122.41 }]);

  const p: string = JSON.parse(String(init?.body)).messages[1].content;
  let out: unknown;
  if (p.includes('Draft the shape')) {
    const slots: [string, string, number, boolean][] = [
      ['09:00', 'fitness', 60, false],
      ['10:00', 'food', 75, true], // starts when stop 1 ends, so travel must push it back
      ['14:00', 'culture', 90, false],
      ['17:00', 'class', 60, true],
      ['19:30', 'food', 90, true],
    ];
    out = {
      slots: slots.map(([start, category, durationMinutes, needsBooking]) => ({
        category, label: `${category} spot`, start, durationMinutes, searchQuery: 'q', needsBooking,
      })),
    };
  } else if (p.includes('Pick the single best')) {
    pick++;
    const isClass = p.includes('Slot: class spot');
    const walkInRound = p.includes('must take walk-ins');
    out = {
      choice: 0,
      reason: 'r',
      venueName: `Venue ${pick}`,
      address: `${pick} Main St, San Francisco`,
      openAtThatTime: pick === 2 ? 'no' : 'yes', // second pick is closed: must be replaced
      hoursEvidence: '8-23',
      pricePerPersonUsd: 20,
      needsReservation: p.includes('Slot: food') || isClass,
      walkInsOk: !isClass || walkInRound,
      bookingUrl: p.includes('Slot: food') ? 'https://resy.com/cities/sf/venue' : null,
      contactEmail: null, // class has no link, no email, no walk-ins: booking must fail, then swap
      title: `Stop ${pick}`,
      description: 'd',
    };
  } else if (p.includes('swap this stop')) {
    out = { category: 'outdoors', label: 'park', searchQuery: 'q', needsBooking: false };
  } else {
    out = { title: 'Day', teaser: 'A day of small surprises', dressCode: 'Comfy layers' };
  }
  return json({ choices: [{ message: { content: '```json\n' + JSON.stringify(out) + '\n```' } }] });
}) as typeof fetch;

console.log = (...a: unknown[]) => {
  if (!String(a[0]).startsWith('[')) process.stdout.write(a.join(' ') + '\n'); // hide [llm] / [booking] logs
};

// ------------------------------------------------------------------ tests

const tz = 'America/Los_Angeles';
const input: PlanInput = {
  date: '2026-11-01',
  windowStart: '09:00',
  windowEnd: '22:00',
  timezone: tz,
  city: 'San Francisco',
  interests: ['climbing'],
  budgetCap: 150,
  bookingConsent: true,
  organizer: { name: 'Test', email: 'test@example.com' },
};
const hhmm = (iso: string) => iso.slice(11, 16);

async function main() {
  assert.equal(toZonedISO(localToDate('2026-11-01', '09:00', tz), tz), '2026-11-01T09:00:00-08:00'); // after DST ends
  assert.equal(toZonedISO(localToDate('2026-07-01', '09:00', tz), tz), '2026-07-01T09:00:00-07:00');
  assert.match(prefillBookingUrl('https://www.opentable.com/r/x', { startsAt: '2026-11-01T19:00:00-08:00', partySize: 3, tz }), /covers=3/);

  const progress: string[] = [];
  const plan = await planDay(input, { progress: (m) => void progress.push(m) });
  for (const s of plan.stops) console.log(`  ${s.position} ${s.venueName.padEnd(9)} ${hhmm(s.startsAt)}-${hhmm(s.endsAt)} ${s.booking.status}`);

  assert.equal(plan.stops.length, 5);
  assert.ok(!plan.stops.some((s) => s.venueName === 'Venue 2'), 'closed venue was kept');
  assert.ok(hhmm(plan.stops[1].startsAt) > '10:00', 'travel did not push stop 2 back');
  assert.equal(plan.stops[1].booking.method, 'link');
  assert.match(plan.stops[1].booking.bookingUrl ?? '', /seats=1/);
  assert.equal(plan.stops[3].booking.status, 'walk_in', 'unbookable class was not swapped for a walk-in');
  assert.ok(progress.some((m) => m.includes('walk-in')));
  assert.ok(progress.every((m) => !/Venue \d/.test(m)), 'a progress message named a venue');

  const late = await replanDay(plan, input, { planId: 'p', reason: 'running_late', fromPosition: 3, delayMinutes: 40 }, { progress: () => {} });
  assert.equal(hhmm(late.stops[0].startsAt), hhmm(plan.stops[0].startsAt));
  assert.equal(hhmm(late.stops[2].startsAt), '14:40');

  const skipped = await replanDay(plan, input, { planId: 'p', reason: 'skip', fromPosition: 1 }, { progress: () => {} });
  assert.equal(skipped.stops.length, 4);
  assert.equal(skipped.stops[0].position, 1);

  const swapped = await replanDay(plan, input, { planId: 'p', reason: 'swap', fromPosition: 2, note: 'tired' }, { progress: () => {} });
  assert.notEqual(swapped.stops[1].venueName, plan.stops[1].venueName);
  assert.equal(swapped.stops[1].startsAt, plan.stops[1].startsAt);

  const seeded = seedPlan({ date: '2026-12-05', timezone: tz });
  assert.ok(seeded.stops.every((s) => s.startsAt.startsWith('2026-12-05')));

  console.log('\nsmoke: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
