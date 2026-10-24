# WONDR

**Tell it when you're free. It plans a mystery outing, puts it on your calendar, and reveals each stop just before you need to go.**

## Inspiration

Making plans is the part of free time nobody enjoys. You scroll maps, read reviews, check opening hours, and by the time you've decided, the afternoon is half gone. We wanted the opposite: hand over a time window and a few interests, and get back a real day out that someone else planned, with a little surprise left in it.

## What it does

1. You sign in with Google. The same consent screen grants calendar access, so there's no second permission step.
2. You give WONDR your area, your free window, and what you're into.
3. An agent on Omnara researches real places and events. It searches with Exa and Google Places, opens the actual venue pages to check dates, addresses and opening hours, and only keeps stops it can back with a source URL inside your time window.
4. You watch it work live: "Looking for events that fit your interests", "Checking dates, addresses, and opening hours"…
5. The plan lands on your Google Calendar as **"WONDR · Mystery stop 1, 2, 3"**, with only the time and a dress code. Friends you list are invited too.
6. Each stop unlocks 45 minutes before it starts. The app reveals the venue, address, directions and what to do there, and **the calendar event updates itself** with the real details.

## How we built it

- **Agent:** Omnara runs the model and the agent loop (`agent/agent.yaml`). Our tools run server-side on Vercel: `search_events` and `search_places` (Exa, Google Places), `fetch_page` (reads the venue's own page), and `save_plan`.
- **Guardrails in code, not in the prompt:** every saved plan is validated with zod. Stops must fall inside the user's window, carry a real HTTP source, and not overlap; times are ISO 8601 with offsets. A malformed plan never reaches the UI.
- **App:** Next.js on Vercel, Supabase for Google auth, Postgres and realtime. The browser creates a `plans` row, the API claims it atomically (so a double click can't launch two paid agent runs), and the agent streams progress into that row.
- **Calendar:** Google Calendar API with an offline refresh token, saved AES-256-GCM encrypted at sign-in. Events are tagged with private extended properties, so re-runs never duplicate them and reveals patch exactly the right event.

## Challenges

- Agents love inventing plausible venues. We made every stop come from a tool result and checked it against its source page, and preferred fewer verified stops over more invented ones.
- Long agent runs vs. serverless limits: the route answers immediately and the run happens after the response, bounded below Vercel's 5-minute limit, with progress written to the database so the page never waits on one request.
- Google only hands over the calendar refresh token once, at the moment of sign-in. Getting that capture right was the difference between a calendar feature and none.

## What's next

- Reservations: prefilled booking links, email requests to venues, and a browser agent for one booking platform, with walk-in swaps as the fallback.
- Re-planning mid-day: "running late", "skip this", "swap it".
- Group days: friends join by link and their preferences merge into the plan.

## Built with

Omnara · Next.js · TypeScript · Vercel · Supabase · Google Calendar API · Exa · Google Places · zod
