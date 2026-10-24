# Agent — teammate #2

## Working now

`create-agent.ts` uses Omnara's official SDK to create a chat with the existing
General agent and send `Hi! What can you do?`. It prints the chat URL so you can
open the response. This checks the connection; it does not generate a day plan yet.

Use Node.js 24 or newer:

```sh
cd agent
npm install
```

For a fresh checkout, copy `.env.example` to `.env` and replace the placeholder
with your Omnara token. The existing local token has already been moved here.
`.env` is ignored by Git.

```sh
npm start
```

Each run creates a new chat. Continue an existing chat in Omnara instead of
running the command again.

## Next implementation

Keep the input/output contract in [build-plan.md](../build-plan.md) unchanged:

```ts
// Input
{ interests: string[], location: string, start: string, end: string }
// Output
{ stops: { time: string, title: string, address: string, url: string, why: string }[] }
```

1. **Configure the planner (`agent.yaml`).** Use Claude via `omnara-openrouter`,
   enable `web_search` and `web_fetch`, and connect Exa MCP. Require JSON matching
   the contract. Include only places/events with sources supporting their time,
   location, and availability; use timezone-aware times inside the input window.
   Prefer fewer verified stops over invented details.
2. **Implement `generatePlan(profile)` (`generate-plan.ts`).** Launch the planner,
   consume its event stream, wait for completion, parse the final JSON, and
   validate the required fields and time window. Return the plan or a clear error.
   Allow an optional progress callback for teammate #1's UI without changing the
   input/output shape. Keep the Omnara token on the server.
3. **Prove one complete run (`try-plan.ts`).** Start with one hardcoded profile
   and print the returned plan. Then check 5–10 profiles, manually verify source
   links, opening/event times, and travel feasibility, and save one real result
   as `demo-plan.json`. Label it as a demo when used as a fallback.

The first milestone is one verified plan returned by `generatePlan(profile)`.
Teammate #1 can then call it from a server-side route and save/display the result.
Leave cron and payments for later.
