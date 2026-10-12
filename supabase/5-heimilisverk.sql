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
