-- Preferences from /preferences. Run once in the Supabase SQL editor.
alter table public.profiles add column if not exists energy_level text;
alter table public.profiles add column if not exists max_travel_miles int;
