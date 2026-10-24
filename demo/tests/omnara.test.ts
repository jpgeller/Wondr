import assert from 'node:assert/strict';
import test from 'node:test';
import { PlanInputSchema, planFromTool } from '../lib/agent/omnara-plan';
import { generateOmnaraPlan, runOmnaraPlan } from '../lib/agent/omnara';
import { cloudTestEnabled } from '../lib/agent/example-profile';

const input = {
  date: '2026-10-31', windowStart: '10:00', windowEnd: '17:00', timezone: 'America/Los_Angeles',
  city: 'San Francisco', interests: ['chess'],
  organizer: { name: 'Joao', email: 'joao@example.com' },
  dietary: ['Vegetarian'], dislikes: ['Karaoke'], budgetCap: 80,
  vibe: 'Cozy. Energy level: Chill. Maximum travel: 5 miles. Going alone.',
};
const suffix = 'a'.repeat(26);
const agent = {
  id: `agt_${suffix}`, org_id: `org_${suffix}`, project_id: `proj_${suffix}`,
  state: 'active', name: 'Test agent', created_at: '2026-10-24T12:00:00Z', updated_at: '2026-10-24T12:00:00Z',
};
const toolCall = { agent_id: agent.id, turn_id: `trn_${suffix}`, provider_call_id: 'test-call', type: 'custom', state: 'ready', created_at: agent.created_at };
const plan = {
  title: 'A day for curiosity', teaser: 'A little strategy and a new neighborhood.', dressCode: 'Comfortable shoes',
  date: input.date, stops: [{
    position: 1, title: 'A game of chess', category: 'social', venueName: 'Test venue', address: 'Test address',
    startsAt: '2026-10-31T11:00:00-07:00', endsAt: '2026-10-31T12:00:00-07:00',
    description: 'A chance to play chess.', sourceUrl: 'https://example.com/chess',
    booking: { status: 'confirmed' },
  }],
};

test('only a valid plan inside the user window reaches the frontend, without invented bookings', () => {
  assert.equal(planFromTool(plan, input).stops[0].booking.status, 'none');
  assert.throws(() => planFromTool({ ...plan, date: '2026-11-01' }, input), /requested date/);
  assert.throws(() => planFromTool({ ...plan, stops: [{ ...plan.stops[0], startsAt: '2026-10-31T09:00:00-07:00' }] }, input), /time window/);
  assert.throws(() => planFromTool({ ...plan, stops: [{ ...plan.stops[0], sourceUrl: 'javascript:alert(1)' }] }, input), /HTTP/);
  assert.throws(() => planFromTool({ ...plan, stops: [] }, input));
  assert.equal(PlanInputSchema.safeParse({ ...input, date: '2026-02-30' }).success, false);
  assert.equal(PlanInputSchema.safeParse({ ...input, timezone: 'not-a-timezone' }).success, false);
  assert.equal(PlanInputSchema.safeParse({ ...input, windowEnd: '09:00' }).success, false);
});

test('cloud run uses the real tool dispatcher, saves to Supabase, and surfaces incomplete runs', async (t) => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://wondr-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
    OMNARA_TOKEN: 'test-omnara', EXA_API_KEY: 'test-exa', GOOGLE_PLACES_API_KEY: 'test-google',
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  let row: Record<string, unknown> = {};
  let calls: Array<{ id: string; name: string; input: unknown }> = [];
  const submitted: string[] = [];
  let providerQuery = '';
  let allowDatabase = true;
  t.mock.method(globalThis, 'fetch', async (request: string | URL | Request, init?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    const method = init?.method || (request instanceof Request ? request.method : 'GET');
    const body = init?.body ? JSON.parse(String(init.body)) : request instanceof Request && method === 'POST' ? await request.json() : {};
    if (url.host === 'wondr-test.supabase.co') {
      assert.ok(allowDatabase, 'The standalone cloud test must not access Supabase');
      if (method === 'PATCH') { Object.assign(row, body); return new Response(null, { status: 204 }); }
      return Response.json(row);
    }
    if (url.host === 'api.exa.ai') {
      providerQuery = body.query;
      return Response.json({ results: [{ title: 'Chess', url: 'https://example.com/chess' }] });
    }
    if (url.host === 'api.omnara.com') {
      if (url.pathname.endsWith('/agents') && method === 'POST') {
        assert.equal(new Headers(init?.headers || (request instanceof Request ? request.headers : {})).get('Idempotency-Key'), 'test-plan');
        const prompt = JSON.parse(body.message.split('\n').slice(1).join('\n'));
        assert.deepEqual(prompt.organizer, input.organizer);
        assert.deepEqual(prompt.dietary, ['Vegetarian']);
        assert.deepEqual(prompt.dislikes, ['Karaoke']);
        assert.equal(prompt.budgetCap, 80);
        assert.match(prompt.vibe, /Chill.*5 miles.*Going alone/);
        return Response.json({ agent });
      }
      if (url.pathname.endsWith('/tool-calls')) return Response.json({ data: calls.map((call) => ({ ...toolCall, ...call })), next_cursor: null });
      if (url.pathname.endsWith('/result')) {
        submitted.push(body.outcome);
        const call = calls.find((call) => url.pathname.includes(call.id))!;
        return Response.json({
          tool_call: { ...toolCall, ...call, state: 'completed', outcome: body.outcome },
          tool_result: { event_id: `evt_${suffix}`, agent_id: agent.id, tool_call_id: call.id,
            outcome: body.outcome, content_blocks: body.content_blocks, created_at: agent.created_at },
        });
      }
      if (url.pathname.endsWith(`/${agent.id}`)) return Response.json({
        agent: { ...agent, activity: { state: 'idle', last_activity_at: agent.updated_at } }, machine_ids: [], mcp_connections: [],
      });
    }
    throw new Error(`Unexpected request: ${method} ${url.origin}${url.pathname}`);
  });
  row = { id: 'test-plan', input, progress: [], status: 'planning' };
  calls = [
    { id: `tcl_${suffix}`, name: 'search_events', input: { query: 'agent chosen chess keywords' } },
    { id: `tcl_${'b'.repeat(26)}`, name: 'save_plan', input: plan },
  ];
  await runOmnaraPlan('test-plan');
  assert.equal(providerQuery, 'agent chosen chess keywords');
  assert.deepEqual(submitted, ['succeeded', 'succeeded']);
  assert.equal(row.status, 'ready');
  assert.deepEqual(row.result, planFromTool(plan, input));

  allowDatabase = false;
  const standalonePlan = await generateOmnaraPlan(input, 'test-plan');
  assert.deepEqual(standalonePlan, planFromTool(plan, input));
  allowDatabase = true;

  row = { id: 'test-plan', input, progress: [], status: 'planning' };
  calls = [];
  await runOmnaraPlan('test-plan');
  assert.equal(row.status, 'failed');
  assert.match(String(row.error), /without a verified plan/);
});

test('the database-free test is available in previews and disabled in production', (t) => {
  const previous = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  Object.assign(process.env, { NODE_ENV: 'production', VERCEL_ENV: 'production' });
  assert.equal(cloudTestEnabled(), false);
  process.env.VERCEL_ENV = 'preview';
  assert.equal(cloudTestEnabled(), true);
});
