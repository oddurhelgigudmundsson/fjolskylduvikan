-- Fjölskylduvikan — Upplýsingabók: WiFi og kóðar, afmæli, stærðir
-- Límdu þetta inn í Supabase: SQL Editor → New query → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- Fæðingardagur fjölskyldumeðlima: afmæliskort á forsíðu, og börn 15 ára og eldri
-- geta breytt sínum eigin stærðum. Foreldrar setja hann inn.
alter table public.profiles add column if not exists birthday date;

-- Heimilið: WiFi (title = nafn netsins, value = lykilorð) og kóðar/annað.
-- parents_only = börnin sjá ekki atriðið.
create table if not exists public.info_items (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'code' check (kind in ('wifi', 'code')),
  title         text not null,
  value         text not null default '',
  parents_only  boolean not null default false,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

-- Afmæli í stórfjölskyldunni (fjölskyldan sjálf notar profiles.birthday).
-- Ár má vanta; þá er aldur ekki sýndur.
create table if not exists public.birthdays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  month       int  not null check (month between 1 and 12),
  day         int  not null check (day between 1 and 31),
  year        int,
  created_by  text references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Stærðir: ein lína á mann. Foreldrar fylla inn; börn 15+ geta breytt sínum.
create table if not exists public.sizes (
  profile_id  text primary key references public.profiles(id) on delete cascade,
  clothes     text,
  pants       text,
  shoes       text,
  other       text,
  updated_by  text references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.info_items enable row level security;
alter table public.birthdays  enable row level security;
alter table public.sizes      enable row level security;
drop policy if exists "family all" on public.info_items;
drop policy if exists "family all" on public.birthdays;
drop policy if exists "family all" on public.sizes;
create policy "family all" on public.info_items for all to authenticated using (true) with check (true);
create policy "family all" on public.birthdays  for all to authenticated using (true) with check (true);
create policy "family all" on public.sizes      for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.info_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.birthdays;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sizes;      exception when duplicate_object then null; end;
end $$;
