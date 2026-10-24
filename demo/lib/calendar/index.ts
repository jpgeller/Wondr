// Google Calendar sync (spec section 8).
//
//   createPlaceholderEvents(planId)  one "Mystery stop N" event per stop, dress code only,
//                                    friends invited as attendees
//   revealEvents(planId, positions)  patch those stops' events with the real venue
//
// Events are found again through private extended properties (wondrPlanId, wondrPosition),
// so no extra table is needed and re-running never duplicates events. A user without a
// saved Google refresh token is skipped quietly.

import { decrypt } from '../crypto';
import { adminDb, getPlanRow } from '../agent/db';
import type { Plan, PlanInput, Stop } from '../types';
import { DEFAULT_TZ } from '../agent/time';

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function accessToken(userId: string): Promise<string | null> {
  const { data } = await adminDb().from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!data?.refresh_token) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(data.refresh_token),
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Google token refresh failed: ${json.error ?? res.status}`);
  return json.access_token;
}

async function google(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

/** Existing WONDR events for a plan, keyed by stop position. */
async function existingEvents(token: string, planId: string): Promise<Map<number, string>> {
  const url = `${API}?privateExtendedProperty=${encodeURIComponent(`wondrPlanId=${planId}`)}&maxResults=50`;
  const data = await google(token, url);
  const map = new Map<number, string>();
  for (const ev of data?.items ?? []) {
    const pos = Number(ev.extendedProperties?.private?.wondrPosition);
    if (pos) map.set(pos, ev.id);
  }
  return map;
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://wondr-1isf.vercel.app';
}

function lockedEvent(planId: string, plan: Plan, stop: Stop, input: PlanInput) {
  const tz = input.timezone ?? DEFAULT_TZ;
  return {
    summary: `WONDR · Mystery stop ${stop.position}`,
    description: `Dress code: ${plan.dressCode}\n\n${plan.teaser}\n\nThe details unlock 45 minutes before. Follow along: ${appUrl()}`,
    start: { dateTime: stop.startsAt, timeZone: tz },
    end: { dateTime: stop.endsAt, timeZone: tz },
    attendees: (input.friendEmails ?? []).map((email) => ({ email })),
    extendedProperties: { private: { wondrPlanId: planId, wondrPosition: String(stop.position) } },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 45 }] },
  };
}

function revealedPatch(stop: Stop) {
  const lines = [
    stop.description,
    `Directions: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.venueName}, ${stop.address}`)}`,
    stop.sourceUrl ? `More: ${stop.sourceUrl}` : null,
    stop.booking.confirmationCode ? `Booking: ${stop.booking.confirmationCode}` : null,
  ];
  return {
    summary: `WONDR · ${stop.title} at ${stop.venueName}`,
    location: stop.address,
    description: lines.filter(Boolean).join('\n\n'),
  };
}

/** Creates any missing placeholder events. Returns how many were created. */
export async function createPlaceholderEvents(planId: string): Promise<number> {
  const row = await getPlanRow(planId);
  if (!row?.result) return 0;
  const token = await accessToken(row.user_id);
  if (!token) return 0;
  const existing = await existingEvents(token, planId);
  const invite = (row.input.friendEmails?.length ?? 0) > 0 ? 'all' : 'none';
  let created = 0;
  for (const stop of row.result.stops) {
    if (existing.has(stop.position)) continue;
    await google(token, `${API}?sendUpdates=${invite}`, {
      method: 'POST',
      body: JSON.stringify(lockedEvent(planId, row.result, stop, row.input)),
    });
    created++;
  }
  return created;
}

/** Patches the given stops' events with the real details. Returns how many were patched. */
export async function revealEvents(planId: string, positions: number[]): Promise<number> {
  const row = await getPlanRow(planId);
  if (!row?.result || positions.length === 0) return 0;
  const token = await accessToken(row.user_id);
  if (!token) return 0;
  const existing = await existingEvents(token, planId);
  const invite = (row.input.friendEmails?.length ?? 0) > 0 ? 'all' : 'none';
  let patched = 0;
  for (const stop of row.result.stops.filter((s) => positions.includes(s.position))) {
    const id = existing.get(stop.position);
    if (!id) continue;
    await google(token, `${API}/${id}?sendUpdates=${invite}`, { method: 'PATCH', body: JSON.stringify(revealedPatch(stop)) });
    patched++;
  }
  return patched;
}

/** Read-only check that a user's calendar is reachable. Used by scripts/check-keys.ts. */
export async function calendarReachable(userId: string): Promise<boolean> {
  const token = await accessToken(userId);
  if (!token) return false;
  await google(token, `${API}?maxResults=1`);
  return true;
}
