-- Fjölskylduvikan — TÖLFRÆÐI: hver og einn (síðustu 28 dagar)
-- Límdu inn í Supabase: SQL Editor → New query → Run. Breytir engu, bara les.
-- Ein lína á mann. Sýnir hverjir nota appið sjálfir, sérstaklega börnin.

with virkni as (
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
sidustu as (select * from virkni where hvenaer >= now() - interval '28 days')
select
  p.name                                                                   as "Nafn",
  case p.role when 'parent' then 'Foreldri' else 'Barn' end                as "Hlutverk",
  (p.pin_hash is not null)                                                 as "Búin(n) að velja PIN",
  exists (select 1 from public.push_subscriptions s where s.profile_id = p.id) as "Kveikt á tilkynningum",
  count(distinct a.hvenaer::date)                                          as "Virkir dagar (af 28)",
  count(a.*)                                                               as "Aðgerðir",
  count(*) filter (where a.hvad = 'verk')                                  as "Verk",
  coalesce((select sum(l.points) from public.chore_log l
            where l.profile_id = p.id and l.status = 'approved'
              and l.created_at >= now() - interval '28 days'), 0)          as "Stig",
  count(*) filter (where a.hvad in ('innkaup', 'innkaup_hakad'))           as "Innkaup",
  count(*) filter (where a.hvad = 'mynd')                                  as "Myndir dagsins",
  count(*) filter (where a.hvad = 'hros')                                  as "Hrós send",
  count(*) filter (where a.hvad in ('aminning', 'aminning_buin'))          as "Áminningar",
  count(*) filter (where a.hvad = 'skilabod')                              as "Skilaboð send",
  to_char(max(a.hvenaer), 'DD.MM. HH24:MI')                                as "Síðast virk(ur)",
  to_char((select max(hvenaer) from virkni w where w.hver = p.id), 'DD.MM.YYYY') as "Síðast virk(ur) nokkurn tímann"
from public.profiles p
left join sidustu a on a.hver = p.id
group by p.id, p.name, p.role, p.pin_hash, p.sort
order by p.role desc, p.sort;
