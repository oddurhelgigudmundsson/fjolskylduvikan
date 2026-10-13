#!/usr/bin/env python3
"""Býr til supabase/ny-fjolskylda.sql: allur gagnagrunnurinn fyrir nýja fjölskyldu í einni skrá.

Keyrt eftir að eitthvað breytist í supabase/*.sql:
    python3 tools/build_setup_sql.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SQL = ROOT / 'supabase'
PARTS = ['schema.sql', '2-myndir.sql', '7-gaelunofn.sql', '3-tilkynningar.sql',
         '4-aminningar.sql', '5-heimilisverk.sql', '6-saman.sql']

HEAD = """\
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
"""

PROFILES_INSERT = """\
alter table public.profiles add column if not exists aliases text[] not null default '{}';

insert into public.profiles (id, name, role, color, emoji, sort, aliases)
select id, nafn, hlutverk, litur, emoji, rod, gaelunofn from _folk
on conflict (id) do update
  set name = excluded.name, role = excluded.role, color = excluded.color,
      emoji = excluded.emoji, sort = excluded.sort, aliases = excluded.aliases;"""

CRON = """\
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
end $$;"""


def main():
    out = [HEAD]
    for name in PARTS:
        text = (SQL / name).read_text()
        if name == 'schema.sql':
            text, n = re.subn(r"insert into public\.profiles .*?sort = excluded\.sort;", PROFILES_INSERT, text, flags=re.S)
            assert n == 1, 'fann ekki prófílana í schema.sql'
        if name == '4-aminningar.sql':
            text, n = re.subn(r"select cron\.schedule\(.*?\n\);", CRON, text, flags=re.S)
            assert n == 1, 'fann ekki klukkuna í 4-aminningar.sql'
        assert 'kuqxnwxcocxecxxwczqm' not in text, f'slóð okkar fjölskyldu er enn í {name}'
        out.append(f'\n-- =====================================================================\n-- {name}\n-- =====================================================================\n{text.strip()}\n')
    out.append('\ndrop table if exists _folk;\ndrop table if exists _uppsetning;\n\n-- Búið. Næst: Authentication → Users → Add user (sjá leiðbeiningarnar).\n')
    (SQL / 'ny-fjolskylda.sql').write_text(''.join(out))
    print('skrifaði', SQL / 'ny-fjolskylda.sql')


if __name__ == '__main__':
    main()
