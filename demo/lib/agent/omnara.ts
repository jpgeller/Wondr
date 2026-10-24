import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runAgent } from 'wondr-agent/run-agent';
import { executeTool } from 'wondr-agent/tools';
import { appendProgress, getPlanRow, markFailed, saveResult } from './db';
import { PlanInputSchema, planFromTool } from './omnara-plan';
import type { Plan, PlanInput } from '../types';

const progress: Record<string, string> = {
  search_events: 'Looking for events that fit your interests',
  search_places: 'Finding nearby places',
  fetch_page: 'Checking dates, addresses, and opening hours',
  save_plan: 'Putting your outing together',
};

export function checkAgentEnvironment() {
  const missing = ['OMNARA_TOKEN', 'EXA_API_KEY', 'GOOGLE_PLACES_API_KEY'].filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

// The same agent runner works with or without a database. Hooks are optional.
export async function generateOmnaraPlan(input: PlanInput, runId: string, hooks: {
  progress?: (message: string, step: string) => Promise<void>;
  save?: (plan: Plan) => Promise<void>;
} = {}): Promise<Plan> {
  checkAgentEnvironment();
  const profile = PlanInputSchema.parse(input);
  const source = await readFile(path.join(process.cwd(), 'node_modules/wondr-agent/agent.yaml'), 'utf8');
  let saved: Plan | undefined;
  await runAgent({
    source, runId, timeoutMs: 220_000,
    message: `Plan a nearby outing using this user profile and time window. Do not make any bookings.\n${JSON.stringify(profile)}`,
    async onCreated(agentID) {
      console.info('[omnara] started', { runId, agentID });
      await hooks.progress?.('Your planner is researching your outing', 'agent_started');
    },
    async execute(name, args) {
      if (progress[name]) await hooks.progress?.(progress[name], name);
      return executeTool(name, args, async (raw) => {
        if (saved) return JSON.stringify({ saved: true, runId });
        const plan = planFromTool(raw, profile);
        await hooks.save?.(plan);
        saved = plan;
        return JSON.stringify({ saved: true, runId });
      });
    },
  });
  if (!saved) throw new Error('The agent finished without a verified plan. Try a broader interest or time window.');
  return saved;
}

// The normal signed-in app stores its progress and result in Supabase.
export async function runOmnaraPlan(planId: string): Promise<void> {
  try {
    const row = await getPlanRow(planId);
    if (!row) throw new Error('Plan not found');
    const plan = await generateOmnaraPlan(row.input, planId, {
      progress: (message, step) => appendProgress(planId, message, step),
      save: (plan) => saveResult(planId, plan, 'planning'),
    });
    await saveResult(planId, plan, 'ready');
    await appendProgress(planId, 'Your plan is ready', 'plan_ready');
  } catch (error) {
    // SDK errors can include request headers; never log the full error object.
    const message = error instanceof Error ? error.message : 'The agent could not finish this plan';
    console.error('[omnara] failed', { planId, message });
    await markFailed(planId, message);
  }
}
