-- =====================================================================
-- Fjölskylduvikan — uppsetning fyrir NÝJA fjölskyldu (allt í einni skrá)
-- Búið til sjálfkrafa úr supabase/*.sql með tools/build_setup_sql.py.
--
-- 1) Breyttu tveimur hlutum hér fyrir neðan: slóðinni og fólkinu.
-- 2) Límdu allt inn í Supabase: SQL Editor → New query → Run.
-- Það er í lagi að keyra þetta aftur (t.d. ef þú breytir nafni).
-- =====================================================================

-- ---------------------------------------------------------------------
-- BREYTTU HÉR (1 af 2): "Project URL" úr Project Settings → API,
-- og nafnið á fallinu í Edge Functions (yfirleitt clever-api).
-- ---------------------------------------------------------------------
create temp table _uppsetning as select
  'https://XXXXXXXXXXXX.supabase.co'::text as project_url,
  'clever-api'::text                       as fn;

-- ---------------------------------------------------------------------
-- BREYTTU HÉR (2 af 2): fólkið í fjölskyldunni.
--   id      – stutt auðkenni, litlir stafir án kommu, t.d. 'gudrun'
--   nafn    – eins og það á að birtast, t.d. 'Guðrún Ósk'
--   hlutverk – 'parent' (foreldri) eða 'child' (barn)
--   litur, emoji – það sem birtist í appinu
--   gælunöfn – annað sem stendur í dagatalinu, t.d. '{Gunna}' (má vera '{}')
-- ---------------------------------------------------------------------
create temp table _folk (id text, nafn text, hlutverk text, litur text, emoji text, rod int, gaelunofn text[]);
insert into _folk values
  ('mamma', 'Mamma',  'parent', '#2563EB', '🏃', 1, '{}'),
  ('pabbi', 'Pabbi',  'parent', '#DB2777', '🌸', 2, '{}'),
  ('barn1', 'Barn 1', 'child',  '#7C3AED', '🦄', 3, '{}'),
  ('barn2', 'Barn 2', 'child',  '#059669', '🌿', 4, '{}');

-- Stoppar ef gleymdist að breyta slóðinni (þá gerist ekkert)
do $$
begin
  if (select project_url from _uppsetning) like '%XXXX%' then
    raise exception 'Settu "Project URL" efst í skjalið (BREYTTU HÉR 1 af 2) og keyrðu aftur.';
  end if;
end $$;

-- =====================================================================
-- schema.sql
-- =====================================================================
-- Fjölskylduvikan — gagnagrunnur
-- (Ný uppsetning: þetta dugar. Eldri uppsetning: keyrðu líka 2-myndir.sql.)
-- Límdu allt þetta inn í Supabase: SQL Editor → New query → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- ---------------------------------------------------------------
-- Prófílar (fjölskyldumeðlimir)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id         text primary key,                 -- t.d. 'oddur'
  name       text not null,
  role       text not null check (role in ('parent', 'child')),
  color      text not null,
  emoji      text not null default '🙂',
  pin_hash   text,                             -- null = PIN ekki valið ennþá
  photo      text,                             -- prófílmynd (lítil JPEG, data-URL)
  sort       int  not null default 0
);

alter table public.profiles add column if not exists aliases text[] not null default '{}';

insert into public.profiles (id, name, role, color, emoji, sort, aliases)
select id, nafn, hlutverk, litur, emoji, rod, gaelunofn from _folk
on conflict (id) do update
  set name = excluded.name, role = excluded.role, color = excluded.color,
      emoji = excluded.emoji, sort = excluded.sort, aliases = excluded.aliases;

-- ---------------------------------------------------------------
-- Innkaupalisti
-- ---------------------------------------------------------------
create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Annað',
  added_by    text references public.profiles(id) on delete set null,
  checked     boolean not null default false,
  checked_by  text references public.profiles(id) on delete set null,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Matseðill vikunnar (einn kvöldmatur á dag)
-- ---------------------------------------------------------------
create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  day          date not null unique,
  title        text not null,
  notes        text,
  ingredients  text[] not null default '{}',
  updated_by   text references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Öryggi: aðeins innskráður fjölskylduaðgangur kemst í gögnin
-- ---------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.shopping_items enable row level security;
alter table public.meals          enable row level security;

drop policy if exists "family all" on public.profiles;
drop policy if exists "family all" on public.shopping_items;
drop policy if exists "family all" on public.meals;

create policy "family all" on public.profiles
  for all to authenticated using (true) with check (true);
create policy "family all" on public.shopping_items
  for all to authenticated using (true) with check (true);
create policy "family all" on public.meals
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------
-- Rauntíma-uppfærslur (listinn uppfærist strax í öllum símum)
-- ---------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.shopping_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.meals;
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- 2-myndir.sql
-- =====================================================================
-- Fjölskylduvikan — prófílmyndir
-- Límdu þetta inn í Supabase: SQL Editor → New query → Run.
-- Myndin er geymd smækkuð (256×256) í gagnagrunninum, svo hún er
-- bara sýnileg innskráðri fjölskyldunni — ekki opin á netinu.

alter table public.profiles add column if not exists photo text;

-- =====================================================================
-- 7-gaelunofn.sql
-- =====================================================================
-- Fjölskylduvikan — gælunöfn í dagatalinu
-- Límdu þetta inn í Supabase: SQL Editor → New query → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.
--
-- Dagatalið finnur hver á viðburð út frá nafninu í titlinum. Fornafnið og
-- algengar beygingar þess (Odds, Pétri, Ölmu, Thelmu) virka sjálfkrafa.
-- Hér má bæta við gælunöfnum eða óreglulegum beygingum, t.d. 'Gummi' eða 'Birni'.

alter table public.profiles add column if not exists aliases text[] not null default '{}';

-- Dæmi (taktu -- framan af og breyttu):
-- update public.profiles set aliases = '{Pési}' where id = 'petur';

-- =====================================================================
-- 3-tilkynningar.sql
-- =====================================================================
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

-- =====================================================================
-- 4-aminningar.sql
-- =====================================================================
-- Fjölskylduvikan — áminningar
-- Límdu ALLT þetta inn í Supabase: SQL Editor → Create a new snippet → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- ---------------------------------------------------------------
-- Áminningar
--   to_id = null  → öll fjölskyldan
--   repeat_days   → vikudagar (0 = sunnudagur … 6 = laugardagur), t.d. {5} = föstudagar
--   once_date     → einu sinni á þessum degi (þá er repeat_days tómt)
--   remind_at     → klukkan hvað tilkynning fer í símann (null = engin tilkynning)
-- ---------------------------------------------------------------
create table if not exists public.reminders (
  id           uuid primary key default gen_random_uuid(),
  to_id        text references public.profiles(id) on delete cascade,
  body         text not null,
  repeat_days  int[] not null default '{}',
  once_date    date,
  remind_at    time,
  created_by   text references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Hakað við "búið" (einn dagur, einn aðili)
create table if not exists public.reminder_done (
  reminder_id  uuid not null references public.reminders(id) on delete cascade,
  day          date not null,
  profile_id   text not null references public.profiles(id) on delete cascade,
  done_at      timestamptz not null default now(),
  primary key (reminder_id, day, profile_id)
);

-- Hvaða tilkynningar hafa farið (svo hver fari bara einu sinni á dag)
create table if not exists public.reminder_pushes (
  reminder_id  uuid not null references public.reminders(id) on delete cascade,
  day          date not null,
  sent_at      timestamptz not null default now(),
  primary key (reminder_id, day)
);

alter table public.reminders       enable row level security;
alter table public.reminder_done   enable row level security;
alter table public.reminder_pushes enable row level security;   -- bara þjónninn

drop policy if exists "family all" on public.reminders;
drop policy if exists "family all" on public.reminder_done;
create policy "family all" on public.reminders
  for all to authenticated using (true) with check (true);
create policy "family all" on public.reminder_done
  for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.reminders;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reminder_done;
  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------
-- Klukka: á 5 mínútna fresti er athugað hvort einhver áminning
-- eigi að fara í síma. Lykillinn tryggir að enginn annar geti kallað á þetta.
-- ---------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

insert into public.app_settings (key, value)
values ('cron', jsonb_build_object('key', gen_random_uuid()::text))
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('fjolskylduvikan-aminningar');
exception when others then null;
end $$;

do $$
declare u text;
begin
  select project_url || '/functions/v1/' || fn into u from _uppsetning;
  perform cron.schedule(
    'fjolskylduvikan-aminningar',
    '*/5 * * * *',
    format($job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', (select value->>'key' from public.app_settings where key = 'cron')
        ),
        body    := '{"action":"cron"}'::jsonb
      );
    $job$, u)
  );
end $$;

-- =====================================================================
-- 5-heimilisverk.sql
-- =====================================================================
-- Fjölskylduvikan — heimilisverk og stigatafla
-- Límdu ALLT þetta inn í Supabase: SQL Editor → Create a new snippet → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.

-- ---------------------------------------------------------------
-- Verkin
--   mode = 'each'    → hver og einn gerir sitt (t.d. búa um rúmið)
--   mode = 'anyone'  → sá sem er fyrstur fær stigin (t.d. ruslið)
--   to_ids           → hvaða börn (tómt = öll börnin)
--   repeat_days      → vikudagar (0 = sunnudagur … 6 = laugardagur)
-- ---------------------------------------------------------------
create table if not exists public.chores (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  emoji           text not null default '🧹',
  points          int  not null default 5 check (points between 1 and 100),
  mode            text not null default 'each' check (mode in ('each', 'anyone')),
  needs_approval  boolean not null default false,
  to_ids          text[] not null default '{}',
  repeat_days     int[] not null default '{0,1,2,3,4,5,6}',
  sort            int not null default 0,
  created_at      timestamptz not null default now()
);

-- Hvert skipti sem verk er klárað
--   status = 'pending' (bíður samþykkis) eða 'approved' (stigin komin)
create table if not exists public.chore_log (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references public.chores(id) on delete cascade,
  profile_id   text not null references public.profiles(id) on delete cascade,
  day          date not null,
  status       text not null default 'approved' check (status in ('pending', 'approved')),
  points       int  not null,
  approved_by  text references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (chore_id, day, profile_id)
);

alter table public.chores    enable row level security;
alter table public.chore_log enable row level security;
drop policy if exists "family all" on public.chores;
drop policy if exists "family all" on public.chore_log;
create policy "family all" on public.chores    for all to authenticated using (true) with check (true);
create policy "family all" on public.chore_log for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.chores;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chore_log;
  exception when duplicate_object then null; end;
end $$;

-- Verkin ykkar til að byrja með (bara ef engin verk eru til fyrir).
-- Þið getið breytt stigum, dögum og öllu öðru í appinu.
insert into public.chores (title, emoji, points, mode, needs_approval, repeat_days, sort)
select * from (values
  ('Búa um rúmið',             '🛏️', 5,  'each',   false, '{0,1,2,3,4,5,6}'::int[], 1),
  ('Draga frá gluggunum',      '🪟', 3,  'each',   false, '{0,1,2,3,4,5,6}'::int[], 2),
  ('Taka til í herberginu',    '🧸', 15, 'each',   true,  '{3,0}'::int[],           3),
  ('Ryksuga herbergið sitt',   '🧹', 15, 'each',   true,  '{6}'::int[],             4),
  ('Fara út með ruslið',       '🗑️', 10, 'anyone', true,  '{0,1,2,3,4,5,6}'::int[], 5),
  ('Taka úr uppþvottavélinni', '🍽️', 10, 'anyone', true,  '{0,1,2,3,4,5,6}'::int[], 6)
) as v(title, emoji, points, mode, needs_approval, repeat_days, sort)
where not exists (select 1 from public.chores);

-- =====================================================================
-- 6-saman.sql
-- =====================================================================
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

drop table if exists _folk;
drop table if exists _uppsetning;

-- Búið. Næst: Authentication → Users → Add user (sjá leiðbeiningarnar).
