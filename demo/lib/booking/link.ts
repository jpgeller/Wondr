// Tier 1: prefill the date, time and party size on booking links for platforms whose
// URL parameters we know. Anything else passes through unchanged.

import { localHHMM } from '../agent/time';

export function prefillBookingUrl(raw: string, opts: { startsAt: string; partySize: number; tz: string }): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const date = opts.startsAt.slice(0, 10);
  const time = localHHMM(opts.startsAt, opts.tz);
  const host = url.hostname.replace(/^www\./, '');

  if (host.endsWith('opentable.com')) {
    url.searchParams.set('covers', String(opts.partySize));
    url.searchParams.set('dateTime', `${date}T${time}`);
  } else if (host.endsWith('resy.com')) {
    url.searchParams.set('date', date);
    url.searchParams.set('seats', String(opts.partySize));
  } else if (host.endsWith('exploretock.com')) {
    url.searchParams.set('date', date);
    url.searchParams.set('size', String(opts.partySize));
    url.searchParams.set('time', time);
  }
  return url.toString();
}
