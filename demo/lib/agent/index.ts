// Entry points the API routes call. AGENT_MODE picks what runs:
//   real  the agent (default)
//   mock  mockPlan with fake progress, so the UI works before the real agent does
//   seed  the pre-tested demo plan with fake progress, the live-demo safety net
// Nothing in the UI changes between them.

import type { PlanInput, ReplanRequest } from '../types';
import { appendProgress, getPlanRow, markFailed, saveResult } from './db';
import { mockPlan } from './mockPlan';
import { seedPlan } from './seed';
import { planDay, replanDay, type AgentHooks } from './planner';

export { mockPlan, planDay, replanDay };
export type { AgentHooks };

const mode = () => process.env.AGENT_MODE || 'real';

function hooksFor(planId: string): AgentHooks {
  return {
    progress: (message, step) => appendProgress(planId, message, step),
    checkpoint: (plan) => saveResult(planId, plan, 'planning'),
  };
}

/** Runs the agent for a plans row in status `planning` and writes result + status. Never throws. */
export async function runPlan(planId: string): Promise<void> {
  try {
    const row = await getPlanRow(planId);
    if (!row) throw new Error('Plan not found');
    const hooks = hooksFor(planId);
    const plan = mode() === 'real' ? await planDay(row.input, hooks) : await fakeRun(row.input, hooks);
    await saveResult(planId, plan, 'ready');
    await appendProgress(planId, 'Your day is ready', 'plan_ready');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent] plan ${planId} failed`, err);
    await markFailed(planId, message);
  }
}

/** Rebuilds the rest of a ready plan. On failure the old plan stays in place. */
export async function runReplan(req: ReplanRequest): Promise<void> {
  try {
    const row = await getPlanRow(req.planId);
    if (!row?.result) throw new Error('Plan has no result to change');
    const next = await replanDay(row.result, row.input, req, hooksFor(req.planId));
    await saveResult(req.planId, next, 'ready');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[agent] replan ${req.planId} failed`, err);
    await appendProgress(req.planId, `Could not change the plan: ${message}`, 'replan_failed');
  }
}

async function fakeRun(input: PlanInput, hooks: AgentHooks) {
  const steps = [
    ['Sketching the shape of your day', 'skeleton'],
    ['Searching the city for a morning walk, climbing, brunch, a museum, a dance class, dinner', 'search_venues'],
    ['Checking opening hours', 'get_venue_details'],
    ['Checking travel time between stops', 'check_travel_time'],
    ['Picking a dress code', 'finalize'],
    ['Booking your dinner', 'make_booking'],
  ];
  for (const [message, step] of steps) {
    await hooks.progress(message, step);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return mode() === 'seed' ? seedPlan(input) : mockPlan(input);
}
