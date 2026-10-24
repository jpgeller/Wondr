# Wondr agent

The model runs in Omnara. The CLI runs the tools on your computer; the
`demo/` web app runs the same tools on Vercel. Each tool is a small function in its own file:

```text
agent/
  user.md                 Example person and outing window
  agent.yaml              Agent instructions and tool input schemas
  create-agent.ts         Create a chat and wait for its result
  run-agent.ts            Reusable cloud launcher with a timeout
  tool-worker.ts          Send tool calls/results between Omnara and these functions
  tools/
    index.ts              Match a tool name to its function
    search_events.ts      Exa web search: { query }
    search_places.ts      Google Places search: { query }
    fetch_page.ts         Exa page contents: { url }
    save_plan.ts          Save locally (the web app supplies a database writer)
  test-tool.ts            Call one tool directly, without creating an agent
  tests/                  Automated offline checks
```

Search queries are sent unchanged. There are no added keywords, domain filters,
city filters, or date filters in the code. The agent chooses the query.
Each search returns up to five results. `fetch_page` reads up to 12,000 characters.
Google returns opening hours when available; this tool does not calculate distance.

## Setup

Use Node.js 24 or newer. From the project root:

```sh
cd agent
npm install
```

For a fresh checkout, copy `.env.example` to `.env`. Fill in:

```dotenv
OMNARA_TOKEN=your_omnara_personal_token
EXA_API_KEY=your_exa_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

`.env` is ignored by Git. Existing shell environment variables take precedence.
Exa uses the same key for searching and page reading. Google needs **Places API
(New)** enabled with billing and an API key allowed to use it. A key restricted
to a different IP or the legacy Places API will not work with this tool.
Provider calls use your account's credits/billing.

- [Exa dashboard](https://dashboard.exa.ai/)
- [Google Places setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key)

## Try one tool

From `agent/`, pass a tool name and a JSON object:

```sh
npm run test:tool -- search_events '{"query":"chess events San Francisco October 31 2026"}'
npm run test:tool -- search_places '{"query":"restaurants in Mission District San Francisco"}'
npm run test:tool -- fetch_page '{"url":"https://example.com"}'
npm run test:tool -- save_plan '{"stops":[]}'
```

These call the actual tool functions and print their results. They do not start
an Omnara agent. Search/page tools need their provider keys; `save_plan` works
without a key. Failed calls exit with a nonzero status and explain the error.

`save_plan` writes a new `output/plan-<id>.json` file each time, so existing plans
are kept. That folder is ignored by Git. The web app replaces this writer with
Supabase storage; it never writes local plan files.

## Run the agent

Edit `user.md`, then run:

```sh
npm start
# Optional task, still including user.md:
npm start -- "Prioritize chess and one new restaurant."
```

Each run creates a new chat. The command prints a chat link, handles tool calls,
saves the plan, and prints the final reply. Keep it running until it finishes.
`agent.yaml` controls general behavior; `tools/*.ts` controls what each tool does.
No tool code needs to be written on Omnara's website.

The worker polls every three seconds and stops when the model is idle or after
five minutes. Closing the terminal stops the worker, not the cloud agent.
Browser follow-ups that call tools also need a running worker.

## Offline checks

```sh
npm test
```

These tests mock provider requests, check unchanged queries, handle errors,
verify local plan output, and cover worker pagination, duplicate calls, and waits.
They do not use API credits. `npm run setup` separately checks your Omnara token
and prints the first organization/project IDs; it does not create a chat.

## Cloud demo

`demo/` installs this folder as the local `wondr-agent` package. Its `/api/plan`
route launches the agent and serves its tools in a Vercel background function.
No laptop process is needed. The `/agent-test` page supplies a profile, shows
progress, and reads the result from Supabase. See [demo setup](../demo/README.md).

`save_plan` now uses the existing frontend Plan shape: title, teaser, dressCode,
date, and up to three stops with position, title, category, venueName, address,
startsAt, endsAt, description, and sourceUrl. The server adds booking status
`none` and validates the requested time window before saving.

After changing this package locally, run `npm ci` in `demo/` to refresh its copy.
Vercel installs the current package from the repo on each clean install.

API references: [Omnara custom tools](https://docs.omnara.com/tools/custom),
[Exa search](https://exa.ai/docs/reference/search),
[Exa contents](https://exa.ai/docs/reference/get-contents),
[Google Places text search](https://developers.google.com/maps/documentation/places/web-service/text-search).
