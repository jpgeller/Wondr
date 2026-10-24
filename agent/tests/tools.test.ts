import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import test from 'node:test'
import { executeTool } from '../tools/index.ts'

test('search queries and page URLs reach the providers unchanged', async (t) => {
  const previous = [process.env.EXA_API_KEY, process.env.GOOGLE_PLACES_API_KEY]
  process.env.EXA_API_KEY = 'test-exa'
  process.env.GOOGLE_PLACES_API_KEY = 'test-google'
  t.after(() => {
    for (const [index, name] of ['EXA_API_KEY', 'GOOGLE_PLACES_API_KEY'].entries()) {
      if (previous[index] === undefined) delete process.env[name]
      else process.env[name] = previous[index]
    }
  })
  const requests: { url: string; options: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    requests.push({ url, options })
    return Response.json({ results: [{ title: 'Provider result', url: 'https://example.com' }] })
  })
  const query = '  chess OR running in San Francisco October 31  '
  const url = 'https://example.com/event?date=2026-10-31'
  for (const [name, input] of [
    ['search_events', { query }], ['search_places', { query }], ['fetch_page', { url }],
  ] as const) {
    const result = await executeTool(name, input)
    assert.equal(result.outcome, 'succeeded')
    assert.equal(JSON.parse(result.content_blocks[0].text).results[0].title, 'Provider result')
  }
  assert.deepEqual(requests.map(({ url }) => url), [
    'https://api.exa.ai/search', 'https://places.googleapis.com/v1/places:searchText', 'https://api.exa.ai/contents',
  ])
  assert.deepEqual(JSON.parse(String(requests[0].options.body)), {
    query, numResults: 5, contents: { text: { maxCharacters: 2000 } },
  })
  assert.deepEqual(JSON.parse(String(requests[1].options.body)), { textQuery: query, pageSize: 5 })
  assert.deepEqual(JSON.parse(String(requests[2].options.body)), { urls: [url], text: { maxCharacters: 12000 } })
  assert.equal(new Headers(requests[0].options.headers).get('x-api-key'), 'test-exa')
  assert.equal(new Headers(requests[1].options.headers).get('X-Goog-Api-Key'), 'test-google')
})

test('missing keys and provider errors are failed tool results', async (t) => {
  const previous = process.env.EXA_API_KEY
  t.after(() => {
    if (previous === undefined) delete process.env.EXA_API_KEY
    else process.env.EXA_API_KEY = previous
  })
  delete process.env.EXA_API_KEY
  const missing = await executeTool('search_events', { query: 'chess' })
  assert.equal(missing.outcome, 'failed')
  assert.match(missing.content_blocks[0].text, /EXA_API_KEY/)

  process.env.EXA_API_KEY = 'test-exa'
  t.mock.method(globalThis, 'fetch', async () => new Response('Rate limit reached', { status: 429 }))
  const rejected = await executeTool('search_events', { query: 'chess' })
  assert.equal(rejected.outcome, 'failed')
  assert.match(rejected.content_blocks[0].text, /429/)
  assert.equal((await executeTool('search_places', { query: '' })).outcome, 'failed')
  assert.equal((await executeTool('fetch_page', { url: 'file:///etc/passwd' })).outcome, 'failed')
})

test('save_plan writes the supplied plan and rejects malformed stops', async (t) => {
  const plan = { stops: [{ time: '2026-10-31T12:00:00-07:00', title: 'Test stop', address: 'Test address', url: 'https://example.com', why: 'Test reason' }] }
  const result = await executeTool('save_plan', plan)
  assert.equal(result.outcome, 'succeeded')
  const saved = JSON.parse(result.content_blocks[0].text)
  t.after(() => rm(saved.file, { force: true }))
  assert.equal(saved.saved, true)
  assert.deepEqual(JSON.parse(await readFile(saved.file, 'utf8')), plan)
  assert.equal((await executeTool('save_plan', { stops: [{}] })).outcome, 'failed')
})
