-- WONDR schema. Owner: B. Shared file: say in chat before editing.
-- Run in the Supabase SQL editor on a fresh project.
--
-- Access model: the browser never reads venue data directly. API routes use the
-- service role key (bypasses RLS). The only table the browser reads is `events`,
-- through Realtime, so it knows when to refetch GET /api/mysteries/:id.
-- That keeps unrevealed stops secret even from a curious user with devtools.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text unique,
  phone text,
  google_refresh_token text,            -- AES-GCM encrypted app-side with TOKEN_ENCRYPTION_KEY
  created_at timestamptz not null default now()
);

-- Create the profile row when someone signs in with Google for the first time.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- preferences
create table public.preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  dietary text[] not null default '{}',
  never_tried text[] not null default '{}',
  budget text not null default '$$' check (budget in ('$', '$$', '$$$')),
  energy_level text not null default 'balanced' check (energy_level in ('chill', 'balanced', 'high')),
  max_travel_minutes int not null default 30,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------ mysteries
create table public.mysteries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  timezone text not null default 'America/Los_Angeles',
  city text not null,                    -- city or neighborhood, free text
  budget_cap_cents int not null,         -- per person, whole day
  vibe text,
  dress_code text,                       -- written by the agent
  teaser text,                           -- one-line vibe line, written by the agent
  status text not null default 'draft'
    check (status in ('draft', 'planning', 'booking', 'ready', 'live', 'done', 'failed')),
  booking_consent boolean not null default false,
  spend_cap_cents int not null default 0, -- max the agent may commit to on the user's behalf
  allow_deposit boolean not null default false,
  demo_mode boolean not null default false,
  invite_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- participants
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  mystery_id uuid not null references public.mysteries(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade, -- null until they sign in
  email text not null,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  joined_at timestamptz,
  unique (mystery_id, email)
);

-- ---------------------------------------------------------------- stops
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  mystery_id uuid not null references public.mysteries(id) on delete cascade,
  position int not null,                 -- 1-based order in the day
  title text not null,                   -- e.g. "Sunrise run along the Embarcadero"
  category text not null,                -- see StopCategory in lib/types.ts
  venue_name text not null,
  address text not null,
  lat double precision,
  lng double precision,
  url text,                              -- venue page the agent validated against
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  description text,                      -- what to do there, shown at reveal
  reveal_at timestamptz not null,
  revealed boolean not null default false,
  needs_booking boolean not null default false,
  status text not null default 'planned'
    check (status in ('planned', 'booked', 'walk_in', 'skipped', 'replaced', 'done')),
  created_at timestamptz not null default now()
);
create index stops_mystery_idx on public.stops (mystery_id, position);

-- ------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops(id) on delete cascade,
  idempotency_key text not null unique,  -- `${stop_id}:${attempt}`; check before booking
  provider text,                         -- opentable, resy, mindbody, venue_site, email...
  method text not null check (method in ('link', 'browser', 'email', 'walk_in')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'walk_in', 'cancelled')),
  party_size int not null default 1,
  confirmation_code text,
  proof_screenshot_url text,
  booking_url text,                      -- tier 1 deep link
  cancel_url text,
  cost_estimate_cents int,
  dry_run boolean not null default true,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------ calendar_events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  google_event_id text not null,
  revealed_in_calendar boolean not null default false,
  unique (stop_id, user_id)
);

-- --------------------------------------------------------------- events
-- Audit log and the realtime channel. Types: see EventType in lib/types.ts.
create table public.events (
  id bigint generated always as identity primary key,
  mystery_id uuid not null references public.mysteries(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_mystery_idx on public.events (mystery_id, id);

-- ------------------------------------------------------------------ RLS
alter table public.users enable row level security;
alter table public.preferences enable row level security;
alter table public.mysteries enable row level security;
alter table public.participants enable row level security;
alter table public.stops enable row level security;
alter table public.bookings enable row level security;
alter table public.calendar_events enable row level security;
alter table public.events enable row level security;

create function public.is_participant(m uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from mysteries where id = m and owner_id = auth.uid())
      or exists (select 1 from participants where mystery_id = m and user_id = auth.uid());
$$;

-- Browser-readable: only the event stream, only for your own mysteries.
-- Every other table has no policy, so only the service role can touch it.
create policy "participants read events" on public.events
  for select using (public.is_participant(mystery_id));

alter publication supabase_realtime add table public.events;
