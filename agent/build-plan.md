# Spontaneous Day Planner

## What we're building
A user logs in with Google and tells us their interests, location, and a time window (e.g. Saturday 2-5pm). An AI agent finds real things to do in that window, like a restaurant, a chess tournament, or a meetup. It verifies times and places and returns a short timeline plan. Hosted live on Vercel + Omnara.

**Stack:** Next.js (TypeScript) on Vercel · Supabase (auth + DB) · Omnara (agent, model, hosting) · Exa (search via MCP) - For further build on top of we would use Stripe.

---

## Contract (don't change without telling the other)

Input to the agent:
{ "interests": string[], "location": string, "start": string, "end": string }

Output from the agent:
{ "stops": [{ "time": string, "title": string, "address": string, "url": string, "why": string }] }

---

## Teammate 1: App (owner of everything the user sees)
1. Next.js app on Vercel, deployed in the first hour
2. Google login with Supabase Auth (redirect URLs set in Supabase + Google Cloud)
3. Profile form that saves interests, location, and time window to a Supabase `profiles` table
4. "Plan my day" button that calls `generatePlan()` from a server-side API route
5. Live progress UI (e.g. "searching events...") from streamed events
6. Timeline view of the plan with links and map links
7. Supabase `plans` table to save results
8. Env vars in Vercel (Supabase keys, Omnara token)

Builds against a hardcoded fake plan until the agent is ready.

---

## Teammate 2: Agent (owner of plan quality)
1. Omnara setup: account, API token, Exa added as an MCP server
2. `agent.yaml` profile: prompt, model (Claude via omnara-openrouter), tools (web_search, web_fetch, Exa), strict JSON output
3. `generatePlan(profile)` in TypeScript with `@omnara/sdk`: launches the agent, streams progress, returns parsed JSON
4. Testing with 5-10 fake profiles until plans are real, open, and inside the window
5. A saved great plan as a demo fallback
6. Bonus: Omnara cron trigger for a daily surprise plan

Tests with a hardcoded fake profile until the app is ready.

