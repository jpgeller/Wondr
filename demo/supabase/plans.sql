-- The current plans contract. Safe to run if the old mysteries schema was used.
-- Run in the SAME Supabase project configured in Vercel.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'planning' check (status in ('planning', 'ready', 'failed')),
  input jsonb not null,
  result jsonb,
  progress jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;
grant select, insert on public.plans to authenticated;
grant all on public.plans to service_role;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'own plans read') then
    create policy "own plans read" on public.plans for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'own plans insert') then
    create policy "own plans insert" on public.plans for insert to authenticated
      with check (user_id = auth.uid() and status = 'planning' and result is null and progress = '[]'::jsonb and error is null);
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plans') then
    alter publication supabase_realtime add table public.plans;
  end if;
end $$;
