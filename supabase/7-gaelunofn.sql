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
