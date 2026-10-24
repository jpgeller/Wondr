# Agent — teammate #2

## Working now

`create-agent.ts` follows step 3 of Omnara's quickstart: read `agent.yaml`, send
the config to Omnara, and create a chat with an initial message. It prints the
chat URL so you can open the response. The YAML currently contains the guide's
engineering assistant example; it does not generate a day plan yet.

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

This sends `Hi! What can you do?`. To supply a different first message:

```sh
npm start -- "Find three interesting things to do in San Francisco this Saturday."
```

Edit `agent.yaml` to change the agent's ongoing instructions, model, or tools.
Each launch reads the saved YAML again and creates a new chat. To continue an
existing chat, use its link in Omnara. No new code file is needed for each task.

## Optional account setup check

`setup.ts` runs the SDK setup snippet from Omnara's documentation. Set
`OMNARA_TOKEN` in `.env` to a **Personal token**, then run `npm run setup` from
this folder. It prints the first available organization and project IDs and
does not create an agent or change the launcher settings. The existing launcher
already has its IDs, so this check is optional.

## Next implementation

Keep the input/output contract in [build-plan.md](build-plan.md) unchanged:

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
