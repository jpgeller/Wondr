// Runs the agent from the terminal against a sample profile, no app or database needed.
//
//   npx tsx --env-file=.env.local scripts/plan.ts               real agent
//   npx tsx --env-file=.env.local scripts/plan.ts --mock        mock plan
//   npx tsx --env-file=.env.local scripts/plan.ts input.json    your own PlanInput
//   ... --out lib/agent/seed/demo-plan.json                       also save the plan to a file
//
// Prints progress as it goes and the final Plan as JSON on stdout.

import { readFileSync, writeFileSync } from 'node:fs';
import { mockPlan, planDay } from '../lib/agent';
import { validatePlan } from '../lib/agent/schema';
import type { PlanInput } from '../lib/types';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
const file = args.find((a, i) => a.endsWith('.json') && i !== outIndex + 1);

const nextSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
};

const input: PlanInput = file
  ? JSON.parse(readFileSync(file, 'utf8'))
  : {
      date: nextSaturday(),
      windowStart: '09:00',
      windowEnd: '21:30',
      timezone: 'America/Los_Angeles',
      city: 'San Francisco, Mission District',
      interests: ['climbing', 'live music', 'natural wine', 'street food'],
      dislikes: ['big crowds'],
      dietary: ['vegetarian'],
      budgetCap: 150,
      vibe: 'adventurous but not exhausting',
      friendEmails: ['friend@example.com'],
      bookingConsent: true,
      organizer: { name: 'Test User', email: 'test@example.com' },
    };

async function main() {
  const started = Date.now();
  const plan = args.includes('--mock')
    ? mockPlan(input)
    : await planDay(input, {
        progress: (message, step) => console.error(`  … ${message}${step ? `  [${step}]` : ''}`),
      });
  validatePlan(plan);
  console.error(`\nDone in ${Math.round((Date.now() - started) / 1000)} s, ${plan.stops.length} stops\n`);
  console.log(JSON.stringify(plan, null, 2));
  if (out) {
    writeFileSync(out, JSON.stringify(plan, null, 2) + '\n');
    console.error(`Saved to ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
