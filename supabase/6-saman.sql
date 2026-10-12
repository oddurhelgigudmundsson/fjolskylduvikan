-- Fjölskylduvikan — Saman: mynd dagsins, hrós og óskalistar
-- Límdu ALLT þetta inn í Supabase: SQL Editor → Create a new snippet → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- ---------------------------------------------------------------
-- 📸 Mynd dagsins — hver og einn má setja eina mynd á dag
-- Myndirnar sjálfar eru í læstri geymslu ("myndir"), aðeins fyrir fjölskylduna.
-- ---------------------------------------------------------------
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  profile_id  text not null references public.profiles(id) on delete cascade,
  day         date not null,
  path        text not null,
  caption     text,
  taken_at    timestamptz,
  created_at  timestamptz not null default now(),
  unique (profile_id, day)
);

create table if not exists public.photo_reactions (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  profile_id  text not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  primary key (photo_id, profile_id)
);

-- ---------------------------------------------------------------
-- 💛 Hrós (to_id = null → öll fjölskyldan)
-- ---------------------------------------------------------------
create table if not exists public.kudos (
  id          uuid primary key default gen_random_uuid(),
  from_id     text not null references public.profiles(id) on delete cascade,
  to_id       text references public.profiles(id) on delete cascade,
  emoji       text not null default '💛',
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 🎁 Óskalistar — claimed_by sést aldrei hjá eigandanum í appinu
-- ---------------------------------------------------------------
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null references public.profiles(id) on delete cascade,
  title       text not null,
  url         text,
  price       int,
  note        text,
  starred     boolean not null default false,
  claimed_by  text references public.profiles(id) on delete set null,
  claimed_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.photos          enable row level security;
alter table public.photo_reactions enable row level security;
alter table public.kudos           enable row level security;
alter table public.wishes          enable row level security;
drop policy if exists "family all" on public.photos;
drop policy if exists "family all" on public.photo_reactions;
drop policy if exists "family all" on public.kudos;
drop policy if exists "family all" on public.wishes;
create policy "family all" on public.photos          for all to authenticated using (true) with check (true);
create policy "family all" on public.photo_reactions for all to authenticated using (true) with check (true);
create policy "family all" on public.kudos           for all to authenticated using (true) with check (true);
create policy "family all" on public.wishes          for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.photos;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.photo_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.kudos;           exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.wishes;          exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------
-- Læst myndageymsla
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('myndir', 'myndir', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "fjolskylda les myndir" on storage.objects;
drop policy if exists "fjolskylda setur inn myndir" on storage.objects;
drop policy if exists "fjolskylda eydir myndum" on storage.objects;
create policy "fjolskylda les myndir" on storage.objects
  for select to authenticated using (bucket_id = 'myndir');
create policy "fjolskylda setur inn myndir" on storage.objects
  for insert to authenticated with check (bucket_id = 'myndir');
create policy "fjolskylda eydir myndum" on storage.objects
  for delete to authenticated using (bucket_id = 'myndir');
