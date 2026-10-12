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

select cron.schedule(
  'fjolskylduvikan-aminningar',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := 'https://kuqxnwxcocxecxxwczqm.supabase.co/functions/v1/clever-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select value->>'key' from public.app_settings where key = 'cron')
    ),
    body    := '{"action":"cron"}'::jsonb
  );
  $job$
);
