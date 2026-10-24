import { z } from 'zod';
import type { Plan, PlanInput } from '../types';
import { PlanSchema } from './schema';
import { DEFAULT_TZ, localToDate } from './time';

export const PlanInputSchema = z.object({
  date: z.iso.date(),
  windowStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  windowEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().default(DEFAULT_TZ).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Use a valid timezone'),
  city: z.string().trim().min(1).max(200),
  interests: z.array(z.string().max(100)).min(1).max(20),
  dislikes: z.array(z.string().max(100)).max(20).optional(),
  dietary: z.array(z.string().max(100)).max(20).optional(),
  budgetCap: z.number().nonnegative().optional(),
  vibe: z.string().max(500).optional(),
  friendEmails: z.array(z.email()).max(20).optional(),
  organizer: z.object({ name: z.string().max(100), email: z.email() }).optional(),
}).refine((input) => input.windowEnd > input.windowStart, 'End time must be later than start time');

// The tool cannot claim bookings. Add that status on the server, then validate
// the existing frontend contract and the user's actual outing window.
export function planFromTool(raw: Record<string, unknown>, input: PlanInput): Plan {
  const stops = Array.isArray(raw.stops) ? raw.stops.map((stop) => ({
    ...(stop && typeof stop === 'object' ? stop : {}), booking: { status: 'none' },
  })) : raw.stops;
  const plan = PlanSchema.parse({ ...raw, stops });
  if (plan.stops.length > 3) throw new Error('Save at most three stops');
  if (plan.date !== input.date) throw new Error('The plan must use the requested date');
  const start = localToDate(input.date, input.windowStart, input.timezone).getTime();
  const end = localToDate(input.date, input.windowEnd, input.timezone).getTime();
  for (const stop of plan.stops) {
    const from = Date.parse(stop.startsAt);
    const to = Date.parse(stop.endsAt);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < start || to > end) {
      throw new Error('Every stop must fit within the requested time window');
    }
    if (!stop.sourceUrl || !/^https?:\/\//i.test(stop.sourceUrl)) {
      throw new Error('Every stop needs a verified HTTP or HTTPS source URL');
    }
  }
  return plan;
}
