// The planning loop (spec section 7).
//
//   1. Draft a skeleton of 4 to 6 slots along an energy curve.
//   2. For every slot at once: search venues (Exa) and scrape the top pages (context.dev).
//   3. Slot by slot, in order: the model picks a candidate, then code validates it
//      (came from a search result, open then, reachable from the previous stop, within
//      budget). A candidate that fails is replaced, not kept.
//   4. Name the day, write the teaser and the dress code. Validate the Plan.
//   5. Book the stops that need it. A stop that cannot be booked is swapped for a walk-in venue.
//
// Progress messages go to the teaser screen, so they never name a venue.

import { generateJSON } from '../llm';
import type { Plan, PlanInput, ReplanRequest, Stop } from '../types';
import { bookStop, type VenueFacts } from '../booking';
import { validatePlan } from './schema';
import {
  CATEGORIES,
  FinalizeSchema,
  PickSchema,
  PLANNER_SYSTEM,
  SkeletonSchema,
  finalizePrompt,
  pickPrompt,
  skeletonPrompt,
  type Candidate,
  type Pick,
  type Slot,
} from './prompts';
import { addMinutes, DEFAULT_TZ, localHHMM, localToDate, toZonedISO, weekday as weekdayOf } from './time';
import { checkTravelTime, geocode, getVenueDetails, searchVenues, type LatLng } from './tools';
import { z } from 'zod';

export type AgentHooks = {
  progress: (message: string, step?: string) => Promise<void> | void;
  /** Called with a valid plan after each booking, so a retry never books twice. */
  checkpoint?: (plan: Plan) => Promise<void> | void;
};

const MAX_TRAVEL_MINUTES = 45;
const MIN_STOPS = 3;
// Vercel stops the function at maxDuration (300 s). Past this budget the agent stops
// adding stops and skips walk-in swaps, keeping a margin for finalize and the last writes.
const TIME_BUDGET_MS = Number(process.env.AGENT_TIME_BUDGET_MS) || 230_000;
const FINISH_RESERVE_MS = 50_000;

type Ctx = {
  input: PlanInput;
  tz: string;
  weekday: string;
  windowEnd: Date;
  hooks: AgentHooks;
  deadline: number; // epoch ms
};

const timeLeft = (ctx: Ctx) => ctx.deadline - Date.now();

type Filled = { stop: Stop; facts: VenueFacts; coords: LatLng | null; slot: Slot; candidates: Candidate[] };
type Prev = { stop: Stop; coords: LatLng | null };

// ------------------------------------------------------------------- plan

export async function planDay(input: PlanInput, hooks: AgentHooks): Promise<Plan> {
  const tz = input.timezone ?? DEFAULT_TZ;
  const ctx: Ctx = {
    input,
    tz,
    weekday: weekdayOf(input.date, tz),
    windowEnd: localToDate(input.date, input.windowEnd, tz),
    hooks,
    deadline: Date.now() + TIME_BUDGET_MS,
  };

  await hooks.progress('Sketching the shape of your day', 'skeleton');
  const { slots } = await generateJSON({
    name: 'skeleton',
    system: PLANNER_SYSTEM,
    prompt: skeletonPrompt(input, ctx.weekday),
    schema: SkeletonSchema,
  });

  await hooks.progress(`Searching the city for ${slots.map((s) => s.label).join(', ')}`, 'search_venues');
  const pools = await Promise.all(slots.map((s) => gatherCandidates(s.searchQuery)));

  const filled: Filled[] = [];
  let spent = 0;
  for (const [i, slot] of slots.entries()) {
    if (filled.length >= MIN_STOPS && timeLeft(ctx) < FINISH_RESERVE_MS) {
      await hooks.progress('Wrapping up the plan with what we have', 'deadline');
      break;
    }
    await hooks.progress(`Choosing your ${slot.label}`, 'get_venue_details');
    const prev = filled.at(-1) ?? null;
    let result = await fillSlot(ctx, {
      slot,
      candidates: pools[i],
      prev,
      used: filled.map((f) => f.stop.venueName),
      budgetLeft: input.budgetCap != null ? input.budgetCap - spent : null,
    });
    if (!result && timeLeft(ctx) > FINISH_RESERVE_MS) {
      await hooks.progress(`Widening the search for your ${slot.label}`, 'search_venues');
      const wider = await gatherCandidates(`${slot.label} ${input.city}`);
      result = await fillSlot(ctx, {
        slot,
        candidates: wider,
        prev,
        used: filled.map((f) => f.stop.venueName),
        budgetLeft: input.budgetCap != null ? input.budgetCap - spent : null,
      });
    }
    if (!result) {
      await hooks.progress(`Dropping the ${slot.label}, nothing fit`, 'validate');
      continue;
    }
    spent += result.facts.pricePerPersonUsd ?? 0;
    filled.push(result);
  }

  if (filled.length < MIN_STOPS) throw new Error(`Only found ${filled.length} stops that passed validation`);
  renumber(filled.map((f) => f.stop));

  await hooks.progress('Picking a dress code', 'finalize');
  let plan = await finalize(ctx, filled.map((f) => f.stop));

  plan = await bookAll(ctx, plan, filled);
  return plan;
}

// ----------------------------------------------------------------- replan

const SwapSchema = z.object({
  category: z.enum(CATEGORIES),
  label: z.string(),
  searchQuery: z.string(),
  needsBooking: z.boolean(),
});

/** Rebuilds the rest of the day from req.fromPosition. Stops before it never change. */
export async function replanDay(plan: Plan, input: PlanInput, req: ReplanRequest, hooks: AgentHooks): Promise<Plan> {
  const tz = input.timezone ?? DEFAULT_TZ;
  const ctx: Ctx = {
    input,
    tz,
    weekday: weekdayOf(input.date, tz),
    windowEnd: localToDate(input.date, input.windowEnd, tz),
    hooks,
    deadline: Date.now() + TIME_BUDGET_MS,
  };
  let stops = plan.stops.map((s) => ({ ...s, booking: { ...s.booking } }));
  const target = stops.find((s) => s.position === req.fromPosition);
  if (!target) throw new Error(`No stop at position ${req.fromPosition}`);

  if (req.reason === 'running_late') {
    const delay = req.delayMinutes ?? 30;
    await hooks.progress(`Shifting the rest of the day by ${delay} minutes`, 'replan');
    stops = stops
      .map((s) => {
        if (s.position < req.fromPosition) return s;
        const startsAt = toZonedISO(addMinutes(new Date(s.startsAt), delay), tz);
        const endsAt = toZonedISO(addMinutes(new Date(s.endsAt), delay), tz);
        const booking = ['pending', 'confirmed'].includes(s.booking.status)
          ? { ...s.booking, note: `Running ${delay} min late, give the venue a heads-up` }
          : s.booking;
        return { ...s, startsAt, endsAt, booking };
      })
      .filter((s) => new Date(s.endsAt) <= ctx.windowEnd);
  } else if (req.reason === 'skip') {
    await hooks.progress(`Skipping stop ${req.fromPosition}`, 'replan');
    stops = stops.filter((s) => s.position !== req.fromPosition);
  } else {
    await hooks.progress(`Finding something new for stop ${req.fromPosition}`, 'replan');
    const prevStop = stops.find((s) => s.position === req.fromPosition - 1);
    const durationMinutes = Math.round((+new Date(target.endsAt) - +new Date(target.startsAt)) / 60_000);
    const swap = await generateJSON({
      name: 'swap',
      system: PLANNER_SYSTEM,
      prompt: `The group wants to swap this stop: ${target.title} (${target.category}) at ${target.venueName}, ${localHHMM(target.startsAt, tz)} for ${durationMinutes} minutes in ${input.city}.
${req.note ? `Their reason: "${req.note}"` : ''}
Other stops today: ${stops.filter((s) => s !== target).map((s) => s.title).join('; ')}
Propose a different kind of activity for the same time slot that fits the reason. searchQuery must name the city and target a single venue's own website.`,
      schema: SwapSchema,
    });
    const slot: Slot = { ...swap, start: localHHMM(target.startsAt, tz), durationMinutes };
    const candidates = await gatherCandidates(swap.searchQuery);
    const prev: Prev | null = prevStop ? { stop: prevStop, coords: latLngOf(prevStop) } : null;
    const result = await fillSlot(ctx, {
      slot,
      candidates,
      prev,
      used: stops.map((s) => s.venueName),
      budgetLeft: null,
      pinnedStart: new Date(target.startsAt),
    });
    if (!result) throw new Error('No replacement venue passed validation');
    result.stop.position = target.position;
    if (result.facts.needsReservation) {
      await hooks.progress(`Booking your new ${slot.label}`, 'make_booking');
      result.stop.booking = await bookStop(result.stop, result.facts, input);
    }
    stops = stops.map((s) => (s === target ? result.stop : s));
  }

  renumber(stops);
  const next = validatePlan({ ...plan, stops });
  await hooks.progress('Your day is updated', 'replan_done');
  return next;
}

// ---------------------------------------------------------------- helpers

async function gatherCandidates(query: string): Promise<Candidate[]> {
  const results = await searchVenues(query).catch((err) => {
    console.error('[agent] search failed', err);
    return [];
  });
  const top = results.slice(0, 4);
  const pages = await Promise.all(top.map((r) => getVenueDetails(r.url)));
  return top.map((r, i) => ({ url: r.url, title: r.title, text: pages[i] ?? r.text }));
}

async function fillSlot(
  ctx: Ctx,
  args: {
    slot: Slot;
    candidates: Candidate[];
    prev: Prev | null;
    used: string[];
    budgetLeft: number | null;
    requireWalkIn?: boolean;
    pinnedStart?: Date; // keep this exact start (swaps); otherwise derived from the slot and travel
  },
): Promise<Filled | null> {
  const { slot, prev } = args;
  const { input, tz } = ctx;
  let pool = [...args.candidates];
  const rejected: string[] = [];
  const nominalStart = args.pinnedStart ?? localToDate(input.date, slot.start, tz);

  for (let attempt = 0; attempt < 3 && pool.length > 0; attempt++) {
    const pick = await generateJSON({
      name: `pick:${slot.label}`,
      system: PLANNER_SYSTEM,
      prompt: pickPrompt({
        input,
        slot,
        weekday: ctx.weekday,
        startHHMM: localHHMM(nominalStart, tz),
        endHHMM: localHHMM(addMinutes(nominalStart, slot.durationMinutes), tz),
        previous: prev ? { venueName: prev.stop.venueName, address: prev.stop.address } : null,
        usedVenues: args.used,
        budgetLeft: args.budgetLeft,
        candidates: pool,
        rejected,
        requireWalkIn: !!args.requireWalkIn,
      }),
      schema: PickSchema,
    });
    if (pick.choice == null || !pool[pick.choice]) return null;
    const candidate = pool[pick.choice];
    pool = pool.filter((_, i) => i !== pick.choice);

    const lastChance = attempt === 2 || pool.length === 0;
    const failure = checkPick(pick, args, lastChance, slot);
    if (failure) {
      rejected.push(`${pick.venueName || candidate.title}: ${failure}`);
      continue;
    }

    const coords = await geocode(pick.address ? pick.address : `${pick.venueName}, ${input.city}`);
    if (!pick.address && !coords) {
      rejected.push(`${pick.venueName}: no address on the page`);
      continue;
    }
    const travel = checkTravelTime(prev?.coords, coords);
    if (prev && travel.minutes > MAX_TRAVEL_MINUTES) {
      rejected.push(`${pick.venueName}: ${travel.minutes} min from the previous stop`);
      continue;
    }

    // Schedule: never before the slot's start or before we can get there.
    let start = nominalStart;
    if (!args.pinnedStart && prev) {
      const earliest = addMinutes(new Date(prev.stop.endsAt), travel.minutes);
      if (earliest > start) start = new Date(Math.ceil(earliest.getTime() / 300_000) * 300_000); // round up to 5 min
    }
    let end = addMinutes(start, slot.durationMinutes);
    if (end > ctx.windowEnd) {
      if (ctx.windowEnd.getTime() - start.getTime() < 45 * 60_000) return null; // no room left today
      end = ctx.windowEnd;
    }

    const stop: Stop = {
      position: 0,
      title: pick.title,
      category: slot.category,
      venueName: pick.venueName,
      address: pick.address || `${pick.venueName}, ${input.city}`,
      ...(coords ?? {}),
      startsAt: toZonedISO(start, tz),
      endsAt: toZonedISO(end, tz),
      description: pick.description,
      sourceUrl: candidate.url,
      booking: { status: 'none' },
    };
    const facts: VenueFacts = {
      needsReservation: pick.needsReservation || slot.needsBooking,
      walkInsOk: pick.walkInsOk,
      bookingUrl: pick.bookingUrl,
      contactEmail: pick.contactEmail,
      pricePerPersonUsd: pick.pricePerPersonUsd,
    };
    return { stop, facts, coords, slot, candidates: args.candidates };
  }
  return null;
}

/** Validation the model is not trusted with. Returns why the pick fails, or null. */
function checkPick(
  pick: Pick,
  args: { used: string[]; budgetLeft: number | null; requireWalkIn?: boolean },
  lastChance: boolean,
  slot: Slot,
): string | null {
  if (!pick.venueName.trim()) return 'no venue name';
  if (args.used.some((u) => u.toLowerCase() === pick.venueName.toLowerCase())) return 'already in the plan';
  if (pick.openAtThatTime === 'no') return 'closed at that time';
  if (pick.openAtThatTime === 'unknown' && !lastChance && slot.category !== 'outdoors') return 'no opening hours found';
  if (args.budgetLeft != null && pick.pricePerPersonUsd != null && pick.pricePerPersonUsd > args.budgetLeft)
    return `costs $${pick.pricePerPersonUsd}, only $${Math.round(args.budgetLeft)} left`;
  if (args.requireWalkIn && !pick.walkInsOk) return 'does not take walk-ins';
  return null;
}

async function finalize(ctx: Ctx, stops: Stop[]): Promise<Plan> {
  const meta = await generateJSON({
    name: 'finalize',
    system: PLANNER_SYSTEM,
    prompt: finalizePrompt(ctx.input, stops),
    schema: FinalizeSchema,
  });
  return validatePlan({ ...meta, date: ctx.input.date, stops });
}

async function bookAll(ctx: Ctx, plan: Plan, filled: Filled[]): Promise<Plan> {
  const { input, hooks } = ctx;
  for (const f of filled) {
    if (!f.facts.needsReservation) {
      f.stop.booking = { status: 'walk_in', note: 'No reservation needed' };
      continue;
    }
    await hooks.progress(`Booking your ${f.slot.label}`, 'make_booking');
    f.stop.booking = await bookStop(f.stop, f.facts, input);

    if (f.stop.booking.status === 'failed' && timeLeft(ctx) > FINISH_RESERVE_MS / 2) {
      await hooks.progress(`Swapping your ${f.slot.label} for a walk-in spot`, 'make_booking');
      const prev = filled[filled.indexOf(f) - 1] ?? null;
      const swap = await fillSlot(ctx, {
        slot: f.slot,
        candidates: f.candidates,
        prev,
        used: filled.map((x) => x.stop.venueName),
        budgetLeft: null,
        requireWalkIn: true,
        pinnedStart: new Date(f.stop.startsAt),
      });
      if (swap) {
        swap.stop.position = f.stop.position;
        swap.stop.endsAt = f.stop.endsAt;
        swap.stop.booking = { status: 'walk_in', note: 'Swapped in: takes walk-ins' };
        Object.assign(f, swap);
      }
    }
    plan = validatePlan({ ...plan, stops: filled.map((x) => x.stop) });
    await hooks.checkpoint?.(plan);
  }
  return validatePlan({ ...plan, stops: filled.map((x) => x.stop) });
}

function renumber(stops: Stop[]) {
  stops.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  stops.forEach((s, i) => (s.position = i + 1));
}

function latLngOf(s: Stop): LatLng | null {
  return s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null;
}
