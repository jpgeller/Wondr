import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runAgent } from 'wondr-agent/run-agent';
import { executeTool } from 'wondr-agent/tools';
import { appendProgress, getPlanRow, markFailed, saveResult } from './db';
import { PlanInputSchema, planFromTool } from './omnara-plan';
import type { Plan } from '../types';

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

// One bounded background run per plan. after() keeps this running on Vercel even
// after the browser has received 202 or closed the page.
export async function runOmnaraPlan(planId: string): Promise<void> {
  try {
    checkAgentEnvironment();
    const row = await getPlanRow(planId);
    if (!row) throw new Error('Plan not found');
    const input = PlanInputSchema.parse(row.input);
    const source = await readFile(path.join(process.cwd(), 'node_modules/wondr-agent/agent.yaml'), 'utf8');
    let saved: Plan | undefined;
    await runAgent({
      source, runId: planId, timeoutMs: 220_000,
      message: `Plan a nearby outing using this user profile and time window. Do not make any bookings.\n${JSON.stringify(input)}`,
      async onCreated(agentID) {
        console.info('[omnara] started', { planId, agentID });
        await appendProgress(planId, 'Your planner is researching your outing', 'agent_started');
      },
      async execute(name, args) {
        if (progress[name]) await appendProgress(planId, progress[name], name);
        return executeTool(name, args, async (raw) => {
          if (saved) return JSON.stringify({ saved: true, planId });
          const plan = planFromTool(raw, input);
          await saveResult(planId, plan, 'planning');
          saved = plan;
          return JSON.stringify({ saved: true, planId });
        });
      },
    });
    if (!saved) throw new Error('The agent finished without a verified plan. Try a broader interest or time window.');
    await saveResult(planId, saved, 'ready');
    await appendProgress(planId, 'Your plan is ready', 'plan_ready');
  } catch (error) {
    // SDK errors can include request headers; never log the full error object.
    const message = error instanceof Error ? error.message : 'The agent could not finish this plan';
    console.error('[omnara] failed', { planId, message });
    await markFailed(planId, message);
  }
}
