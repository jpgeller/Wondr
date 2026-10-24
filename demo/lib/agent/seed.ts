// AGENT_MODE=seed: the pre-tested demo plan (spec section 13), moved onto the requested
// date with the same local times. Kept inside the app folder, not in a separate seed/
// folder at the repo root, because Vercel only deploys the app folder.
//
// Regenerate it from a real run whose bookings worked:
//   npx tsx --env-file=.env.local scripts/plan.ts --out lib/agent/seed/demo-plan.json

import type { Plan, PlanInput } from '../types';
import { validatePlan } from './schema';
import { DEFAULT_TZ, localHHMM, localToDate, toZonedISO } from './time';
import seed from './seed/demo-plan.json';

export function seedPlan(input: Pick<PlanInput, 'date' | 'timezone'>): Plan {
  const tz = input.timezone ?? DEFAULT_TZ;
  const move = (iso: string) => toZonedISO(localToDate(input.date, localHHMM(iso, tz), tz), tz);
  const plan = validatePlan(seed);
  return {
    ...plan,
    date: input.date,
    stops: plan.stops.map((s) => ({ ...s, startsAt: move(s.startsAt), endsAt: move(s.endsAt) })),
  };
}
