import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/cloud-test/route';

test('cloud form rejects invalid input and cross-origin requests before starting an agent', async (t) => {
  const previous = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  Object.assign(process.env, { NODE_ENV: 'production', VERCEL_ENV: 'preview' });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Invalid form must not call external services'); });
  const request = (body: unknown, origin = 'https://preview.example') => new Request('https://preview.example/api/cloud-test', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await POST(request({}))).status, 400);
  assert.equal((await POST(request({ city: 'San Francisco', date: '2026-10-25', windowStart: '17:00', windowEnd: '10:00' }))).status, 400);
  assert.equal((await POST(request({}, 'https://another.example'))).status, 403);
  process.env.VERCEL_ENV = 'production';
  assert.equal((await POST(request({}))).status, 404);
});
