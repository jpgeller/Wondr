// Merges the user's saved preferences (/preferences -> profiles) into a plan's input,
// so the agent plans around what they love, skips their hard passes, and respects diet,
// budget, energy and travel distance. Values typed on the plan form win.

import { adminDb } from './db';
import type { PlanInput } from '../types';

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

export async function withProfile(userId: string, input: PlanInput): Promise<PlanInput> {
  const { data: p } = await adminDb().from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (!p) return input;

  const notes = [
    p.energy_level ? `Energy level: ${p.energy_level}.` : null,
    p.max_travel_miles ? `Keep every stop within about ${p.max_travel_miles} miles of the start and of each other.` : null,
    p.dislikes?.length ? `Hard pass, never include: ${p.dislikes.join(', ')}.` : null,
  ].filter(Boolean);

  return {
    ...input,
    city: input.city || p.city,
    interests: uniq([...(input.interests ?? []), ...(p.interests ?? [])]).slice(0, 20),
    dislikes: uniq([...(input.dislikes ?? []), ...(p.dislikes ?? [])]).slice(0, 20),
    dietary: uniq([...(input.dietary ?? []), ...(p.dietary ?? [])]).slice(0, 20),
    budgetCap: input.budgetCap ?? p.default_budget ?? undefined,
    vibe: [input.vibe, ...notes].filter(Boolean).join(' ').slice(0, 500) || undefined,
  };
}
