// Prompts and the zod schemas for each model call. Schemas use nullable instead of
// optional so they work with both providers' JSON modes.

import { z } from 'zod';
import type { PlanInput, Stop } from '../types';

export const CATEGORIES = ['fitness', 'wellness', 'food', 'drinks', 'culture', 'class', 'outdoors', 'nightlife', 'other'] as const;

export const PLANNER_SYSTEM = `You are WONDR, an agent that plans a surprise day out in a real city for a small group of friends.
The group does not know the plan. They see only start times and a dress code until each stop is revealed.
You only ever choose real venues that appear in the search results you are given. Never invent a venue, address, price or opening hour.
Write in a warm, playful, concise voice.`;

function profileBlock(input: PlanInput): string {
  const partySize = 1 + (input.friendEmails?.length ?? 0);
  return [
    `City / area: ${input.city}`,
    `Date: ${input.date}`,
    `Free from ${input.windowStart} to ${input.windowEnd} local time`,
    `Party size: ${partySize}`,
    `Interests: ${input.interests.join(', ') || 'open to anything'}`,
    input.dislikes?.length ? `Dislikes (avoid): ${input.dislikes.join(', ')}` : null,
    input.dietary?.length ? `Dietary needs (every food stop must fit): ${input.dietary.join(', ')}` : null,
    input.budgetCap != null ? `Budget: about $${input.budgetCap} per person for the whole day` : null,
    input.vibe ? `Requested vibe: ${input.vibe}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------- skeleton

export const SkeletonSchema = z.object({
  slots: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        label: z.string().describe('Generic 1-3 word name of the activity type, never a venue. e.g. "brunch", "yoga class"'),
        start: z.string().describe('Local start time HH:MM (24h)'),
        durationMinutes: z.number().int().min(30).max(240),
        searchQuery: z.string().describe('Web search query that finds individual venue websites for this slot'),
        needsBooking: z.boolean().describe('true if this kind of place normally needs a reservation'),
      }),
    )
    .min(4)
    .max(6),
});
export type Skeleton = z.infer<typeof SkeletonSchema>;
export type Slot = Skeleton['slots'][number];

export function skeletonPrompt(input: PlanInput, weekday: string): string {
  return `${profileBlock(input)}
Day of week: ${weekday}

Draft the shape of the day: 4 to 6 slots that follow an energy curve (active morning, food midday, creative or cultural afternoon, social evening), trimmed to the free window.
Leave 20 to 30 minutes between slots for travel. The first slot starts at or after ${input.windowStart}; the last one ends by ${input.windowEnd}.
Mix in at least one thing from the interests and, if it fits, one thing they have probably never tried.
Each searchQuery must name the city or neighborhood and target a single venue's own website, e.g. "vinyasa yoga studio drop-in class Mission District San Francisco".`;
}

// -------------------------------------------------------------- pick venue

export const PickSchema = z.object({
  choice: z.number().int().nullable().describe('Index of the chosen candidate, or null if none is acceptable'),
  reason: z.string().describe('One sentence: why this candidate, or why none fit'),
  venueName: z.string(),
  address: z.string().describe('Street address with city, copied from the page. Empty if unknown'),
  openAtThatTime: z.enum(['yes', 'likely', 'no', 'unknown']),
  hoursEvidence: z.string().describe('The opening-hours text you relied on, quoted briefly'),
  pricePerPersonUsd: z.number().nullable(),
  needsReservation: z.boolean(),
  walkInsOk: z.boolean(),
  bookingUrl: z.string().nullable().describe('Reservation link on the page (OpenTable, Resy, Tock, Mindbody, the venue booking page)'),
  contactEmail: z.string().nullable().describe('Reservation or contact email on the page'),
  title: z.string().describe('Short evocative stop title, e.g. "Sunrise flow above the bay"'),
  description: z.string().describe('2-3 sentences shown at reveal: what to do there and one tip'),
});
export type Pick = z.infer<typeof PickSchema>;

export type Candidate = { url: string; title: string; text: string };

export function pickPrompt(args: {
  input: PlanInput;
  slot: Slot;
  weekday: string;
  startHHMM: string;
  endHHMM: string;
  previous: { venueName: string; address: string } | null;
  usedVenues: string[];
  budgetLeft: number | null;
  candidates: Candidate[];
  rejected: string[];
  requireWalkIn: boolean;
}): string {
  const list = args.candidates
    .map((c, i) => `### Candidate ${i}\nURL: ${c.url}\nTitle: ${c.title}\n${c.text}`)
    .join('\n\n');
  return `${profileBlock(args.input)}

Slot: ${args.slot.label} (${args.slot.category}), ${args.weekday} ${args.startHHMM} to ${args.endHHMM}.
${args.previous ? `Previous stop: ${args.previous.venueName}, ${args.previous.address}. Prefer places close to it.` : 'This is the first stop of the day.'}
${args.budgetLeft != null ? `Budget left per person: $${Math.max(0, Math.round(args.budgetLeft))}.` : ''}
${args.usedVenues.length ? `Already in the plan (do not repeat): ${args.usedVenues.join('; ')}` : ''}
${args.requireWalkIn ? 'This stop must take walk-ins: the reservation did not work out.' : ''}
${args.rejected.length ? `Already rejected:\n- ${args.rejected.join('\n- ')}` : ''}

Pick the single best candidate for this slot. Rules:
- It must be one specific venue (not a list article or a chain's homepage without a location).
- It must be open for the whole slot on ${args.weekday}. Read the hours on the page; answer "no" if it is closed then, "unknown" if the page has no hours.
- It must respect the dislikes and dietary needs.
- Copy the address, price, booking link and email from the page only. Use null when the page does not say.
If none is acceptable, set choice to null and fill the other fields with empty strings, false or null.

${list}`;
}

// ---------------------------------------------------------------- finalize

export const FinalizeSchema = z.object({
  title: z.string().describe('Playful name for the day, no venue names'),
  teaser: z.string().describe('One line that sets the mood without giving any stop away'),
  dressCode: z.string().describe('One short line that works for every stop, e.g. "Comfy athleisure, bring a light layer"'),
});

export function finalizePrompt(input: PlanInput, stops: Stop[]): string {
  const lines = stops.map((s) => `${s.position}. ${s.title} (${s.category}) at ${s.venueName}: ${s.description}`).join('\n');
  return `${profileBlock(input)}

The finished day:
${lines}

Name the day, write the teaser, and choose one dress code that works for every stop (think about the most active and the dressiest stop).
The title and teaser are shown before any reveal, so they must not name or hint at a specific venue.`;
}
