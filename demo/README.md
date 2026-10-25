# Wondr cloud demo

## Quick cloud test — no Supabase needed

Open `/cloud-test` on a **Vercel Preview deployment**, complete the onboarding
steps, and click **Plan my mystery day**. The ready screen leads to the mystery
timeline. Click any stop to reveal or hide its place, details, and source link.
Omnara runs the model; Vercel runs the tools. No local worker is needed.
Keep the tab open while it runs; this test does not persist generated results
after refresh. Each new demo starts a fresh questionnaire.

Only `OMNARA_TOKEN`, `EXA_API_KEY`, and `GOOGLE_PLACES_API_KEY` are required for
this test. Set them for Preview and deploy again after changing values.
Keep Vercel Authentication enabled for previews so only team members can run it.
The page and endpoint return 404 in Production; locally they work with `npm run dev`.

## Signed-in app

The homepage signs in with Google, then opens welcome → name/location → interests
and hard passes → practical preferences → day details → ready → mystery timeline.
The homepage and **Plan another day** always ask all four steps again, even for
the same account. Previous answers and draft positions are not prefilled.

`POST /api/preferences` saves the usual fields in `profiles` and the complete form
in the user's Supabase `user_metadata.wondr_preferences`; no new SQL migration is
needed. Each plan stores
an input snapshot containing the name, interests, restrictions, budget, energy,
travel radius, date, times, timezone, vibe, and friends. `lib/preferences.ts` validates
and converts these answers to the existing agent contract.

## Frontend design

The welcome and results pages use the supplied `public/brand/wondr-wander.png`
artwork as a background. `components/day-timeline.tsx` shows only the saved stops,
with venue details hidden until clicked. Any stop can be revealed early;
there is no second generation form or late/skip/swap control.
`components/onboarding.module.css` contains the cream, navy, and orange design.
The logo retains the supplied wordmark's shapes through an SVG mask.

Likes, hard passes, dietary preferences, and vibe each accept an **Other** text
answer. The reveal shows a short description, a linked address, and a Google
Places photo when available. `POST /api/place-photo` keeps the Google key on the
server, fetches fresh photo references, and returns author attribution. Production
requires sign-in; the protected cloud preview can use the same endpoint.

New plans may include `googlePlaceId`, `travelFromPrevious` (walking/driving,
estimated minutes and miles), and `admission` (kind, optional verified price and
ticket URL). Older plans still render. The agent must leave enough travel time
between stops. Ticket receipts are visual prototypes, explicitly marked Preview;
they do not call Stripe, purchase tickets, or change booking status. Restaurants
never get the ticket treatment.

For local visual review, open `/design-preview` while running `npm run dev`.
It uses sample stops and live venue photos without generating an agent plan.
This route returns 404 outside development. Use `/cloud-test` for a real run.

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
