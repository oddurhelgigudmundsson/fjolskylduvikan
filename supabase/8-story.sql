-- Fjölskylduvikan — Story: myndir sem lifa í 24 klukkutíma
-- Límdu þetta inn í Supabase: SQL Editor → New query → Run.
-- Það er í lagi að keyra þetta oftar en einu sinni.
-- Myndirnar sjálfar fara í sömu læstu geymslu og Mynd dagsins ("myndir", undir story/).
-- Klukkan (clever-api, á 5 mín fresti) eyðir útrunnum myndum úr geymslunni.

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  profile_id  text not null references public.profiles(id) on delete cascade,
  path        text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_expires_at on public.stories (expires_at);

create table if not exists public.story_reactions (
  story_id    uuid not null references public.stories(id) on delete cascade,
  profile_id  text not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  primary key (story_id, profile_id)
);

alter table public.stories         enable row level security;
alter table public.story_reactions enable row level security;
drop policy if exists "family all" on public.stories;
drop policy if exists "family all" on public.story_reactions;
create policy "family all" on public.stories         for all to authenticated using (true) with check (true);
create policy "family all" on public.story_reactions for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.stories;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.story_reactions; exception when duplicate_object then null; end;
end $$;
