import assert from 'node:assert/strict';
import test from 'node:test';
import { planFromTool } from '../lib/agent/omnara-plan';
import { stopSummary } from '../lib/stop-summary';
import seed from '../lib/agent/seed/demo-plan.json';

test('new stop details survive validation without claiming a purchase', () => {
  const stops = seed.stops.slice(0, 2).map((stop, index) => ({ ...stop,
    googlePlaceId: 'ChIJ_example', admission: { kind: 'ticket', ticketUrl: 'https://example.com/tickets', priceUsd: 25 },
    ...(index ? { travelFromPrevious: { mode: 'driving', minutes: 20, distanceMiles: 5 } } : {}),
  }));
  const input = { date: seed.date, windowStart: '09:00', windowEnd: '14:00', city: 'San Francisco', interests: ['Art'], timezone: 'America/Los_Angeles' };
  const plan = planFromTool({ ...seed, stops }, input);
  assert.equal(plan.stops[0].googlePlaceId, 'ChIJ_example');
  assert.equal(plan.stops[0].admission?.ticketUrl, 'https://example.com/tickets');
  assert.equal(plan.stops[1].travelFromPrevious?.minutes, 20);
  assert.equal(plan.stops[1].booking.status, 'none');
  assert.throws(() => planFromTool({ ...seed, stops: [stops[0], { ...stops[1], travelFromPrevious: { mode: 'walking', minutes: 50, distanceMiles: 5 } }] }, input), /enough time/);
  assert.throws(() => planFromTool({ ...seed, stops: [{ ...stops[0], admission: { kind: 'ticket', ticketUrl: 'javascript:alert(1)' } }] }, input));
});

test('older descriptions display at most two short sentences', () => {
  assert.equal(stopSummary('First sentence. Second sentence. Third sentence.'), 'First sentence. Second sentence.');
  const short = stopSummary('A museum with ' + 'many interesting exhibits '.repeat(40));
  assert.ok(short.length <= 240);
  assert.ok(short.split(/\s+/).length <= 35);
  assert.ok(short.endsWith('…'));
});
