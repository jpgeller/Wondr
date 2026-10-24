# Wondr cloud demo

## Quick cloud test — no Supabase needed

Open `/cloud-test` on a **Vercel Preview deployment**, choose a location and time
window, and click **Generate plan**. It uses Joao's example interests and displays
the returned stops. Click a stop to reveal its place, details, and source link.
Omnara runs the model; Vercel runs the tools. No local worker is needed.
Keep the tab open while it runs; this test does not persist results after refresh.

Only `OMNARA_TOKEN`, `EXA_API_KEY`, and `GOOGLE_PLACES_API_KEY` are required for
this test. Set them for Preview and deploy again after changing values.
Keep Vercel Authentication enabled for previews so only team members can run it.
The page and endpoint return 404 in Production; locally they work with `npm run dev`.

## Signed-in app

Sign in from the homepage (or open `/agent-test`), edit the example
location and time window, and press **Generate plan**. The signed-in homepage now
opens the same planner directly. Both show progress and the saved stops.

## Frontend design

The working app uses the design from `main-design/`: its landscape, dark form,
timeline, and place dialog. `components/planner-view.tsx` is shared by the signed-in
planner and the database-free cloud test; `planner.module.css` contains the styles.
The original supplied brand sheet lives at `public/brand/wondr-reference.png`.
The header frames its white wordmark directly, preserving the original artwork.
Reveal photographs are illustrative and labelled as such; credits are in
`main-design/README.md`. Time between stops comes from the plan, not estimated travel.

## What runs where

1. The browser inserts a `plans` row in Supabase and calls `POST /api/plan` with
   `{planId}` and its Supabase access token.
2. The endpoint verifies ownership, atomically claims the row, and returns 202.
3. Next.js `after()` runs `agent/run-agent.ts` on Vercel. Omnara runs the model;
   Vercel executes the existing files in `agent/tools/` and sends results back.
4. `save_plan` validates and stores the result in Supabase. Once the agent finishes,
   the status becomes `ready`; the page polls every two seconds to display it.

This is a bounded demo worker: it stops the Omnara run after about four minutes
and records failure before the function's five-minute limit. A deployment/process
crash is not automatically resumed. Longer or recoverable jobs should later use
webhooks or a durable worker. There are no scheduled plans or automatic bookings.

## Vercel

Use project `wondr-1isf`, Root Directory `demo`, Next.js, Node 24. Keep **Include
files outside the root directory** enabled: `agent/` is a local package dependency.
`vercel.json` uses `npm ci` so edits in `agent/` refresh the installed copy.
The package `files` list excludes local credentials and generated plans.

Required environment variables (Production and Preview):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server secret)
- `OMNARA_TOKEN` (server secret)
- `EXA_API_KEY` (server secret)
- `GOOGLE_PLACES_API_KEY` (server secret)

`OMNARA_API_KEY`, `OMNARA_BASE_URL`, `LLM_PROVIDER`, and `AGENT_MODE` belong to the
older planner scripts. The main `/api/plan` route now always uses the Omnara SDK.
The existing `/api/plan/replan` implementation is unchanged and is not used by the
test page.

Push to `main` to deploy. Environment changes require a new deployment.

## Supabase

Use the same project as the Vercel Supabase variables. If `public.plans` is missing,
run [supabase/plans.sql](supabase/plans.sql) in its SQL editor. This adds the current
plan contract without replacing the older tables in `schema.sql`.

The test page uses the existing `/login` and `/auth/callback` flow. Google sign-in
must be enabled under Authentication → Sign In / Providers. Under
Authentication → URL Configuration, set the site URL to the production domain and
allow `https://wondr-1isf.vercel.app/auth/callback**` as a redirect. Add
`http://localhost:3000/auth/callback**` for local testing. The Google OAuth client needs
the callback URL shown by Supabase in its Google provider settings.

## Local development

Use Node 24. From `demo/`:

```sh
npm ci
cp .env.example .env.local  # fresh checkout only; fill the six variables above
npm run dev
```

After editing `agent/`, run `npm ci` again to refresh the local package copy.

```sh
npm test
npm run build
```

The tests mock external services. A final live check is: stop any local agent
worker, open the deployed page, sign in, generate a plan, and refresh the page to
confirm the saved result remains available.
