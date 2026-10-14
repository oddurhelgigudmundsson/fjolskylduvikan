-- Fjölskylduvikan — TÖLFRÆÐI: vikuyfirlit fjölskyldunnar (síðustu 12 vikur)
-- Límdu inn í Supabase: SQL Editor → New query → Run. Breytir engu, bara les.
-- Ein lína á viku. Keyrðu í hverju verkefni (hverri fjölskyldu) fyrir sig.
--
-- Athugið:
--  * Innkaupavörur sem eru hreinsaðar út („Hreinsa“) eru farnar, svo innkaupatölurnar eru lágmark.
--  * Story hverfur eftir 24 klst og er því ekki talin hér.
--  * Hvenær appið er OPNAÐ er ekki skráð; hér er talin VIRKNI (eitthvað var gert).

with virkni as (
  -- Ein lína fyrir hverja aðgerð: hver, hvenær, hvað
  select profile_id as hver, created_at as hvenaer, 'verk'           as hvad from public.chore_log
  union all select added_by,   created_at, 'innkaup'         from public.shopping_items where added_by is not null
  union all select checked_by, checked_at, 'innkaup_hakad'   from public.shopping_items where checked_by is not null and checked_at is not null
  union all select profile_id, created_at, 'mynd'            from public.photos
  union all select from_id,    created_at, 'hros'            from public.kudos
  union all select created_by, created_at, 'aminning'        from public.reminders where created_by is not null
  union all select profile_id, done_at,    'aminning_buin'   from public.reminder_done
  union all select from_id,    created_at, 'skilabod'        from public.notifications where from_id is not null
  union all select owner_id,   created_at, 'osk'             from public.wishes
  union all select claimed_by, claimed_at, 'osk_tekin_fra'   from public.wishes where claimed_by is not null and claimed_at is not null
  union all select updated_by, updated_at, 'matsedill'       from public.meals where updated_by is not null
),
vikur as (
  select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as vika
)
select
  to_char(v.vika, 'DD.MM.YYYY')                                                     as "Vika (mánudagur)",
  count(distinct a.hver)                                                            as "Virkir alls",
  count(distinct a.hver) filter (where p.role = 'parent')                           as "Virkir foreldrar",
  count(distinct a.hver) filter (where p.role = 'child')                            as "Virk börn",
  (select count(*) from public.profiles)                                            as "Í fjölskyldunni",
  count(distinct a.hvenaer::date)                                                   as "Dagar með virkni (af 7)",
  count(a.hvad)                                                                      as "Aðgerðir alls",
  count(*) filter (where a.hvad = 'verk')                                           as "Verk merkt",
  count(*) filter (where a.hvad = 'verk' and p.role = 'child')                      as "…þar af börn",
  count(*) filter (where a.hvad = 'innkaup')                                        as "Vörur á lista",
  count(*) filter (where a.hvad = 'innkaup_hakad')                                  as "Vörur keyptar",
  count(distinct a.hvenaer::date) filter (where a.hvad = 'mynd')                    as "Dagar með mynd dagsins",
  count(*) filter (where a.hvad = 'mynd')                                           as "Myndir",
  count(*) filter (where a.hvad = 'hros')                                           as "Hrós",
  count(*) filter (where a.hvad = 'aminning')                                       as "Nýjar áminningar",
  count(*) filter (where a.hvad = 'aminning_buin')                                  as "Áminningum lokið",
  count(*) filter (where a.hvad = 'skilabod')                                       as "Skilaboð frá foreldrum",
  count(*) filter (where a.hvad = 'matsedill')                                      as "Matseðill (dagar)",
  count(*) filter (where a.hvad in ('osk', 'osk_tekin_fra'))                        as "Óskalistar"
from vikur v
left join virkni a on date_trunc('week', a.hvenaer) = v.vika
left join public.profiles p on p.id = a.hver
group by v.vika
order by v.vika desc;
