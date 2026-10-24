// Timezone helpers with no dependencies. Every time we store is ISO 8601 with the
// offset of the plan's timezone, e.g. "2026-11-01T09:00:00-07:00".

export const DEFAULT_TZ = 'America/Los_Angeles';

/** Offset of `tz` at instant `at`, in minutes east of UTC (-420 for PDT). */
function offsetMinutes(at: Date, tz: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT-07:00" or "GMT"
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "2026-11-01" + "09:00" in tz -> Date. Handles DST by re-checking the offset once. */
export function localToDate(date: string, hhmm: string, tz: string = DEFAULT_TZ): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = new Date(naiveUtc - offsetMinutes(new Date(naiveUtc), tz) * 60_000);
  guess = new Date(naiveUtc - offsetMinutes(guess, tz) * 60_000);
  return guess;
}

/** Date -> "2026-11-01T09:00:00-07:00" in tz. */
export function toZonedISO(at: Date, tz: string = DEFAULT_TZ): string {
  const off = offsetMinutes(at, tz);
  const local = new Date(at.getTime() + off * 60_000);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.toISOString().slice(0, 19)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** "HH:MM" local time of an instant in tz, for prompts. */
export function localHHMM(at: Date | string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(at),
  );
}

/** "Sunday" for the plan date, so the model can check weekly opening hours. */
export function weekday(date: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(localToDate(date, '12:00', tz));
}

export const addMinutes = (at: Date, minutes: number) => new Date(at.getTime() + minutes * 60_000);
