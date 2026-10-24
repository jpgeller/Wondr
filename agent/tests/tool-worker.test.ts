import assert from 'node:assert/strict'
import test from 'node:test'
import { rm } from 'node:fs/promises'
import { runToolWorker, type ToolWorkerApi } from '../tool-worker.ts'
import { executeTool, type ToolResult } from '../tools/index.ts'

const quiet = { pollMs: 0, log: () => {} }

test('handles paginated calls once and waits for idle after save_plan', async (t) => {
  const oldExa = process.env.EXA_API_KEY
  const oldGoogle = process.env.GOOGLE_PLACES_API_KEY
  process.env.EXA_API_KEY = 'test-exa'
  process.env.GOOGLE_PLACES_API_KEY = 'test-google'
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [] }))
  t.after(() => {
    if (oldExa === undefined) delete process.env.EXA_API_KEY
    else process.env.EXA_API_KEY = oldExa
    if (oldGoogle === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = oldGoogle
  })
  const results = new Map<string, ToolResult>()
  const submissions: string[] = []
  let activityChecks = 0
  const api: ToolWorkerApi = {
    async listReadyCalls(cursor) {
      if (cursor === 'page-two') {
        return {
          data: [
            { id: 'page', name: 'fetch_page', input: { url: 'https://example.com/event' } },
            { id: 'save', name: 'save_plan', input: { stops: [] } },
          ],
          next_cursor: null,
        }
      }
      // Repeat these IDs on the next poll to exercise deduplication.
      return {
        data: [
            { id: 'events', name: 'search_events', input: { query: 'chess SF' } },
            { id: 'places', name: 'search_places', input: { query: 'restaurants SF' } },
        ],
        next_cursor: 'page-two',
      }
    },
    async submitResult(id, result) {
      submissions.push(id)
      results.set(id, result)
      if (id === 'save' && result.outcome === 'succeeded') {
        const { file } = JSON.parse(result.content_blocks[0].text)
        t.after(() => rm(file, { force: true }))
      }
    },
    async getActivity() {
      return ++activityChecks === 1 ? 'running' : 'idle'
    },
  }
  await runToolWorker(api, quiet)
  assert.deepEqual(submissions, ['events', 'places', 'page', 'save'])
  assert.equal(activityChecks, 2)
  for (const result of results.values()) {
    assert.equal(result.outcome, 'succeeded')
    assert.equal(result.content_blocks[0].type, 'text')
    assert.doesNotThrow(() => JSON.parse(result.content_blocks[0].text))
  }
})

test('unknown tools and malformed input produce failed results', async () => {
  const result = await executeTool('toString', {})
  assert.equal(result.outcome, 'failed')
  assert.match(result.content_blocks[0].text, /Unknown tool/)
  assert.equal((await executeTool('search_events', null)).outcome, 'failed')
  assert.equal((await executeTool('search_events', [])).outcome, 'failed')
})

test('a rejected submission stops the worker without reporting success', async () => {
  const logs: string[] = []
  await assert.rejects(runToolWorker({
    async listReadyCalls() {
      return { data: [{ id: 'bad', name: 'unknown_tool', input: {} }], next_cursor: null }
    },
    async submitResult() { throw new Error('Submission rejected') },
    async getActivity() { throw new Error('Must not check activity after submission fails') },
  }, { ...quiet, log: (line) => logs.push(line) }), /Submission rejected/)
  assert.deepEqual(logs, [])
})

test('a question or permission request is surfaced instead of waiting forever', async () => {
  await assert.rejects(runToolWorker({
    async listReadyCalls() { return { data: [], next_cursor: null } },
    async submitResult() {},
    async getActivity() { return 'waiting_on_interaction' },
  }, quiet), /needs an answer or approval/)
})

test('a stalled run is bounded by a deadline', async () => {
  await assert.rejects(runToolWorker({
    async listReadyCalls() { return { data: [], next_cursor: null } },
    async submitResult() {},
    async getActivity() { return 'running' },
  }, { ...quiet, timeoutMs: 10 }), /timed out/)
})
