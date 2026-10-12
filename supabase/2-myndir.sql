-- Fjölskylduvikan — prófílmyndir
-- Límdu þetta inn í Supabase: SQL Editor → New query → Run.
-- Myndin er geymd smækkuð (256×256) í gagnagrunninum, svo hún er
-- bara sýnileg innskráðri fjölskyldunni — ekki opin á netinu.

alter table public.profiles add column if not exists photo text;
