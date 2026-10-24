import { z } from 'zod';
import type { PlanInput } from './types';

const list = z.array(z.string().trim().min(1).max(100)).max(20);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const PreferencesSchema = z.object({
  name: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(200),
  interests: list.min(1),
  dislikes: list,
  dietary: list,
  budget: z.number().int().min(0).max(300),
  energy: z.enum(['Chill', 'Balanced', 'High energy']),
  travel: z.number().int().min(1).max(20),
  date: z.iso.date(),
  windowStart: time,
  windowEnd: time,
  timezone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }),
  vibe: z.enum(['Adventurous', 'Cozy', 'Romantic', 'Social', 'Creative']),
  budgetCap: z.number().int().min(0).max(300),
  friendEmails: z.array(z.email()).max(20),
}).refine((p) => p.windowEnd > p.windowStart, 'Choose an end time later than the start.')
  .refine((p) => !p.interests.some((item) => p.dislikes.includes(item)), 'An interest cannot also be a hard pass.');

export type Preferences = z.infer<typeof PreferencesSchema>;

export function defaultPreferences(name = ''): Preferences {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    name, city: 'San Francisco', interests: [], dislikes: [], dietary: [],
    budget: 80, energy: 'Balanced', travel: 5,
    date: tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
    windowStart: '09:00', windowEnd: '22:00', timezone: 'America/Los_Angeles',
    vibe: 'Adventurous', budgetCap: 80, friendEmails: [],
  };
}

// All answers have an account-backed home, including fields without profiles columns.
// The ordinary profiles columns remain available to the rest of the app.
export function savedPreferences(profile: Record<string, unknown> | null, metadata: Record<string, unknown> = {}): Preferences {
  const saved = PreferencesSchema.safeParse(metadata.wondr_preferences);
  const base = defaultPreferences(String(profile?.display_name || metadata.full_name || ''));
  if (saved.success) return { ...saved.data, date: saved.data.date < base.date ? base.date : saved.data.date };
  if (!profile) return base;
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 20) : [];
  const budget = typeof profile.default_budget === 'number' ? Math.max(0, Math.min(300, profile.default_budget)) : base.budget;
  return {
    ...base, city: String(profile.city || base.city),
    interests: strings(profile.interests), dislikes: strings(profile.dislikes), dietary: strings(profile.dietary),
    windowStart: String(profile.default_window_start || base.windowStart).slice(0, 5),
    windowEnd: String(profile.default_window_end || base.windowEnd).slice(0, 5),
    budget, budgetCap: budget,
    energy: ['Chill', 'Balanced', 'High energy'].includes(String(profile.energy_level)) ? profile.energy_level as Preferences['energy'] : base.energy,
    travel: typeof profile.max_travel_miles === 'number' ? Math.max(1, Math.min(20, profile.max_travel_miles)) : base.travel,
  };
}

export function preferencesToInput(p: Preferences, email: string): PlanInput {
  return {
    city: p.city, date: p.date, windowStart: p.windowStart, windowEnd: p.windowEnd, timezone: p.timezone,
    interests: p.interests, dislikes: p.dislikes, dietary: p.dietary, budgetCap: p.budgetCap,
    organizer: { name: p.name, email }, friendEmails: p.friendEmails, bookingConsent: false,
    vibe: `${p.vibe}. Energy level: ${p.energy}. Maximum travel: ${p.travel} miles from the starting area and between stops. Usual budget: $${p.budget} per person; today's cap is $${p.budgetCap}. ${p.friendEmails.length ? `Going with ${p.friendEmails.length} friend(s).` : 'Going alone.'}`,
  };
}
