# Contract (spec v3, section 5)

Shared file: say in chat before editing. TypeScript shapes live in [`lib/types.ts`](../lib/types.ts); this file says who writes what and when. Replaces the earlier `api-contract.md` (mysteries/stops/events), which v3 dropped.

## How a plan is made

1. **Plan my day** (B): the app inserts a `plans` row with `status = 'planning'`, `input` = a `PlanInput` snapshot (profile + form), `progress = []`. Then it calls `POST /api/plan` with `{ planId }`.
2. **The route** (A): checks the user is signed in and owns the row, answers `202 {}` at once, and runs the agent after the response (`after()`, `maxDuration = 300`).
3. **The agent** (A): appends `ProgressMessage`s to `plans.progress` while it works, then writes `plans.result` (a `Plan` validated with zod) and sets `status = 'ready'`. On error: `status = 'failed'` and `plans.error`.
4. **The timeline** (B): subscribes to the row with Supabase Realtime (`postgres_changes` on `plans`, `id=eq.<planId>`), or polls every 2 s as a fallback. It shows `progress` while planning and renders `result` once `status = 'ready'`.

`plans.result` may also be written while `status` is still `planning` (a checkpoint after each booking, so a retry never double books). The UI should only render `result` when `status = 'ready'`.

`AGENT_MODE=mock` makes the same route return [`mockPlan`](../lib/agent/mockPlan.ts) after about 9 s of fake progress, so B can build the whole flow before the real agent works.

## Endpoints (A builds)

| Method and path | Body | Returns | Notes |
|---|---|---|---|
| `POST /api/plan` | `PlanRequest` `{ planId }` | `202 {}` | owner only; row must be `planning` with empty `progress` (409 otherwise) |
| `POST /api/plan/replan` | `ReplanRequest` | `202 {}` | owner only; row must be `ready`. Rewrites `result` from `fromPosition` on (running late / skip / swap), appends progress. On failure the old plan stays and a `replan_failed` progress message is added |

Auth: the Supabase session cookie, or `Authorization: Bearer <access token>` for curl. Errors return `ApiError` `{ error }` with 4xx.

## Tables (B creates, A writes `plans`)

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  interests text[] not null default '{}',
  dislikes text[] not null default '{}',
  dietary text[] not null default '{}',
  default_window_start text default '09:00',   -- local HH:MM
  default_window_end text default '22:00',
  default_budget int,                          -- USD per person
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'planning' check (status in ('planning', 'ready', 'failed')),
  input jsonb not null,                        -- PlanInput
  result jsonb,                                -- Plan
  progress jsonb not null default '[]',        -- ProgressMessage[]
  error text,
  created_at timestamptz not null default now()
);

create table public.google_tokens (           -- rung 4
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,                 -- encrypted app-side
  scopes text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.google_tokens enable row level security;   -- no policies: service role only

create policy "own profile" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own plans read" on public.plans for select using (user_id = auth.uid());
create policy "own plans insert" on public.plans for insert with check (user_id = auth.uid());

alter publication supabase_realtime add table public.plans;
```

The agent writes `plans` with the service role key, so users never need update rights on it. Bookings live inside `Plan.stops[].booking`, no separate table.

## Filling `PlanInput`

| Field | From |
|---|---|
| `date`, `vibe`, `budgetCap`, `friendEmails`, `bookingConsent` | Plan my day form |
| `windowStart`, `windowEnd` | form, defaulting to the profile; local `HH:MM` |
| `timezone` | the browser: `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `city`, `interests`, `dislikes`, `dietary` | profile |
| `organizer` | the signed-in user `{ name, email }`; reservation emails go out under it and replies go to it |
| `allowDeposit` | leave unset unless the form asks |

## Rules both sides rely on

- Every stored time is ISO 8601 **with an offset** (`2026-11-01T09:00:00-08:00`). Only `PlanInput.windowStart/windowEnd` are local `HH:MM`.
- A stop is revealed when `now >= startsAt - 45 min`. Use `isRevealed(stop, now)` from `lib/types.ts`; demo mode passes a fake `now`.
- For the hackathon the browser gets the whole plan and the UI hides locked stops.
- `progress` messages, `Plan.title` and `Plan.teaser` never name a venue, so they are safe to show before any reveal.
- `booking.status`: `none` (nothing needed or not authorized), `pending` (link to tap, or email sent), `confirmed` (has `confirmationCode`, maybe `proofUrl`), `walk_in`, `failed`. `booking.note` is a short line for the chip; `booking.bookingUrl` is the link to tap for `method: 'link'`.
