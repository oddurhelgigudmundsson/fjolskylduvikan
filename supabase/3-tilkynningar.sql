-- Fjölskylduvikan — tilkynningar
-- Límdu þetta inn í Supabase: SQL Editor → New snippet → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- Símar sem hafa kveikt á tilkynningum (einn síma = ein lína)
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  profile_id  text not null references public.profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  updated_at  timestamptz not null default now()
);

-- Skilaboð sem foreldrar hafa sent (to_id = null þýðir öll fjölskyldan)
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  from_id     text references public.profiles(id) on delete set null,
  to_id       text references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Stillingar sem aðeins þjónninn les (t.d. lyklar fyrir tilkynningar)
create table if not exists public.app_settings (
  key    text primary key,
  value  jsonb not null
);

alter table public.push_subscriptions enable row level security;
alter table public.notifications      enable row level security;
alter table public.app_settings       enable row level security;   -- engin regla = enginn aðgangur nema þjónninn

drop policy if exists "family all" on public.push_subscriptions;
drop policy if exists "family read" on public.notifications;

create policy "family all" on public.push_subscriptions
  for all to authenticated using (true) with check (true);
create policy "family read" on public.notifications
  for select to authenticated using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
