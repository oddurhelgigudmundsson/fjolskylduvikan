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

insert into public.profiles (id, name, role, color, emoji, sort) values
  ('oddur',   'Oddur',       'parent', '#2563EB', '🏃', 1),
  ('kristin', 'Kristín',     'parent', '#DB2777', '🌸', 2),
  ('alma',    'Alma Rún',    'child',  '#7C3AED', '🦄', 3),
  ('thelma',  'Thelma Lind', 'child',  '#059669', '🌿', 4),
  ('petur',   'Pétur Ingi',  'child',  '#EA580C', '⚽', 5)
on conflict (id) do update
  set name = excluded.name, role = excluded.role, sort = excluded.sort;

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
