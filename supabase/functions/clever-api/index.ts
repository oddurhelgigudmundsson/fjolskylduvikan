// Fjölskylduvikan — þjónn (Supabase Edge Function "clever-api")
// 1) Dagatal: les Google-dagatöl fjölskyldunnar (leynileg iCal-slóð) og skilar
//    viðburðum á tilteknu tímabili, merktum þeim sem þeir tilheyra.
// 2) Tilkynningar: foreldrar senda skilaboð á einn eða alla (Web Push).
// 3) Áminningar: klukka í gagnagrunninum (pg_cron) kallar hér á 5 mín fresti
//    og áminningar sem eiga að fara núna eru sendar í síma viðkomandi.
// 4) Heimilisverk: foreldrar fá tilkynningu þegar verk bíður samþykkis, og börnin
//    þegar það er samþykkt. (Sigurvegara vikunnar tilkynna foreldrarnir sjálfir.)
//
// Leyndarmál (Supabase → Edge Functions → Secrets):
//   ICAL_HEIMILID  – leynileg iCal-slóð "Heimilið"
//   ICAL_ODDUR     – leynileg iCal-slóð "Heimilið vol.2" (oddurhelgi@gmail.com)
// Lyklar fyrir tilkynningar búa sig til sjálfir í fyrsta skipti (tafla app_settings).

import ICAL from 'npm:ical.js@2.2.1';
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Hvaða dagatöl eru lesin. "fallback" = hver á viðburðinn ef ekkert nafn er í titlinum.
const FEEDS = [
  { secret: 'ICAL_HEIMILID', fallback: ['allir'] },
  { secret: 'ICAL_ODDUR', fallback: ['oddur'] },
];

// Nöfn sem þekkjast í titli viðburðar → prófíll í appinu.
// Byrjun orðs nægir, svo beygingar fylgja með (Odd/Odds, Kristínu, Ölmu, Thelmu, Pétri).
const PEOPLE = [
  { id: 'oddur', names: ['odd'] },
  { id: 'kristin', names: ['kristín', 'kristin'] },
  { id: 'alma', names: ['alma', 'ölmu', 'almu'] },
  { id: 'thelma', names: ['thelm'] },
  { id: 'petur', names: ['pétur', 'pétri', 'petur', 'petri'] },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Klukkan (pg_cron) — notar eigin lykil, ekki innskráningu
  const cronKey = req.headers.get('x-cron-key');
  if (cronKey) {
    try {
      const { data } = await admin().from('app_settings').select('value').eq('key', 'cron').maybeSingle();
      if (!data?.value?.key || data.value.key !== cronKey) return json({ error: 'forbidden' }, 403);
      return json(await runReminders());
    } catch (e) {
      console.error(e);
      return json({ error: 'server_error', detail: String(e?.message || e) }, 500);
    }
  }

  // Aðeins innskráður fjölskylduaðgangur kemst að
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const auth = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'));
  const { data: who, error: authError } = await auth.auth.getUser(token);
  if (authError || !who?.user) return json({ error: 'not_signed_in' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  try {
    if (body.action === 'vapid') return json({ publicKey: (await vapidKeys()).publicKey });
    if (body.action === 'send') return await sendNotice(body);
    if (body.action === 'chore_done') return await choreDone(body);
    if (body.action === 'chore_review') return await choreReview(body);
    return await calendar(body);
  } catch (e) {
    console.error(e);
    return json({ error: 'server_error', detail: String(e?.message || e) }, 500);
  }
});

// Þjónslykill: gefinn sjálfkrafa í öllum Supabase Edge Functions
const admin = () => createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

// ------------------------------------------------------------------
// Tilkynningar
// ------------------------------------------------------------------
let cachedKeys = null;
async function vapidKeys() {
  if (cachedKeys) return cachedKeys;
  const db = admin();
  const { data, error } = await db.from('app_settings').select('value').eq('key', 'vapid').maybeSingle();
  if (error) throw error;
  if (data?.value?.publicKey) return (cachedKeys = data.value);
  const keys = webpush.generateVAPIDKeys();
  const ins = await db.from('app_settings').insert({ key: 'vapid', value: keys });
  if (ins.error) {
    // annað kall var á undan að búa til lykla → nota þá
    const again = await db.from('app_settings').select('value').eq('key', 'vapid').single();
    if (again.error) throw again.error;
    return (cachedKeys = again.value);
  }
  return (cachedKeys = keys);
}

async function sendNotice({ from, to, body }) {
  const text = String(body || '').trim().slice(0, 300);
  if (!text) return json({ error: 'empty' }, 400);
  const db = admin();

  const { data: sender } = await db.from('profiles').select('id, name, role').eq('id', from).maybeSingle();
  if (!sender || sender.role !== 'parent') return json({ error: 'parents_only' }, 403);

  const toId = to && to !== 'allir' ? String(to) : null;
  const saved = await db.from('notifications').insert({ from_id: sender.id, to_id: toId, body: text }).select('id').single();
  if (saved.error) throw saved.error;

  const res = await pushTo(db, toId, {
    title: sender.name.split(' ')[0],
    body: text,
    tag: 'fv-' + saved.data.id,
    url: './',
  });
  return json({ ok: true, ...res });
}

// Senda á síma eins aðila (toId) eða allra (null). Skilar { sent, devices }.
async function pushTo(db, toId, message) {
  let q = db.from('push_subscriptions').select('*');
  if (toId) q = q.eq('profile_id', toId);
  const { data: subs, error } = await q;
  if (error) throw error;
  if (!subs?.length) return { sent: 0, devices: 0 };

  const keys = await vapidKeys();
  webpush.setVapidDetails('mailto:oddurhelgi@gmail.com', keys.publicKey, keys.privateKey);
  const payload = JSON.stringify(message);

  let sent = 0;
  const gone = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: 'high' });
      sent++;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);   // síminn hættur að taka við
      else console.error('push failed', e?.statusCode, e?.body || String(e));
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return { sent, devices: subs.length };
}

// ------------------------------------------------------------------
// Áminningar
// ------------------------------------------------------------------
export function icelandNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Atlantic/Reykjavik', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    day,
    weekday: new Date(day + 'T12:00:00Z').getUTCDay(),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toMinutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

export function isDue(r, now, windowMin = 30) {
  if (!r.remind_at) return false;
  const today = r.once_date ? r.once_date === now.day : (r.repeat_days || []).includes(now.weekday);
  if (!today) return false;
  const at = toMinutes(r.remind_at);
  return at <= now.minutes && at > now.minutes - windowMin;   // ekki gamlar áminningar ef einhver bætir við seint
}

async function runReminders() {
  const db = admin();
  const now = icelandNow();
  const { data: all, error } = await db.from('reminders').select('*').not('remind_at', 'is', null);
  if (error) throw error;
  const due = (all || []).filter((r) => isDue(r, now));
  if (!due.length) return { checked: (all || []).length, sent: 0 };

  const { data: done } = await db.from('reminder_done').select('reminder_id, profile_id').eq('day', now.day);
  const doneSet = new Set((done || []).map((d) => d.reminder_id + '|' + d.profile_id));

  let sent = 0;
  for (const r of due) {
    if (r.to_id && doneSet.has(r.id + '|' + r.to_id)) continue;           // þegar búið
    const mark = await db.from('reminder_pushes').insert({ reminder_id: r.id, day: now.day });
    if (mark.error) continue;                                              // þegar sent í dag
    const res = await pushTo(db, r.to_id, { title: '📌 Áminning', body: r.body, tag: 'rem-' + r.id + '-' + now.day, url: './' });
    sent += res.sent;
  }
  return { checked: (all || []).length, due: due.length, sent };
}

// ------------------------------------------------------------------
// Heimilisverk
// ------------------------------------------------------------------
const first = (name) => String(name || '').split(' ')[0];

async function loadLog(db, id) {
  const { data: log, error } = await db.from('chore_log').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!log) return null;
  const [{ data: chore }, { data: kid }] = await Promise.all([
    db.from('chores').select('title, emoji, points').eq('id', log.chore_id).maybeSingle(),
    db.from('profiles').select('id, name').eq('id', log.profile_id).maybeSingle(),
  ]);
  return { ...log, chore, kid };
}

async function choreDone({ log_id }) {
  const db = admin();
  const log = await loadLog(db, log_id);
  if (!log || log.status !== 'pending') return json({ ok: true, sent: 0 });
  const { data: parents } = await db.from('profiles').select('id').eq('role', 'parent');
  let sent = 0;
  for (const p of parents || []) {
    const r = await pushTo(db, p.id, {
      title: `👀 ${first(log.kid?.name)} kláraði verk`,
      body: `${log.chore?.emoji || ''} ${log.chore?.title || ''} — samþykkja?`.trim(),
      tag: 'chore-' + log.id,
      url: './',
    });
    sent += r.sent;
  }
  return json({ ok: true, sent });
}

async function choreReview({ log_id, approve, by }) {
  const db = admin();
  const { data: parent } = await db.from('profiles').select('id, name, role').eq('id', by).maybeSingle();
  if (!parent || parent.role !== 'parent') return json({ error: 'parents_only' }, 403);
  const log = await loadLog(db, log_id);
  if (!log) return json({ ok: true, gone: true });

  const what = `${log.chore?.emoji || ''} ${log.chore?.title || ''}`.trim();
  if (approve) {
    const up = await db.from('chore_log').update({ status: 'approved', approved_by: parent.id }).eq('id', log.id);
    if (up.error) throw up.error;
    await pushTo(db, log.profile_id, { title: `⭐ +${log.points} stig!`, body: `${first(parent.name)} samþykkti: ${what}`, tag: 'chore-' + log.id, url: './' });
  } else {
    const del = await db.from('chore_log').delete().eq('id', log.id);
    if (del.error) throw del.error;
    await pushTo(db, log.profile_id, { title: '🔁 Ekki alveg búið', body: `${first(parent.name)}: ${what} — reyndu aftur 🙂`, tag: 'chore-' + log.id, url: './' });
  }
  return json({ ok: true });
}

// ------------------------------------------------------------------
// Dagatal
// ------------------------------------------------------------------
async function calendar(body) {
  const from = new Date(body.from + 'T00:00:00Z');
  const to = new Date(body.to + 'T23:59:59Z');
  if (isNaN(from) || isNaN(to) || to - from > 62 * 86400000) return json({ error: 'bad_range' }, 400);

  const feeds = FEEDS.map((f) => ({ ...f, url: Deno.env.get(f.secret) })).filter((f) => f.url);
  if (!feeds.length) return json({ error: 'no_calendars' }, 500);

  const seen = new Set();
  const events = [];
  const failed = [];

  const texts = await Promise.all(feeds.map(async (f) => {
    try {
      const res = await fetch(f.url, { headers: { 'User-Agent': 'Fjolskylduvikan/1.0' } });
      if (!res.ok) throw new Error(String(res.status));
      return await res.text();
    } catch (e) {
      failed.push(f.secret);
      console.error('feed failed', f.secret, String(e));
      return null;
    }
  }));

  feeds.forEach((feed, i) => {
    if (!texts[i]) return;
    for (const ev of expandFeed(texts[i], from, to)) {
      const key = ev.uid + '|' + ev.start;               // sami viðburður í báðum dagatölum → einu sinni
      if (seen.has(key)) continue;
      seen.add(key);
      const people = whoIsIt(ev.title);
      events.push({ ...ev, id: key, people: people.length ? people : feed.fallback });
    }
  });

  events.sort((a, b) => a.start.localeCompare(b.start));
  return json({ events, failed });
}

export function whoIsIt(title) {
  const t = ' ' + String(title || '').toLowerCase() + ' ';
  return PEOPLE.filter((p) => p.names.some((n) => new RegExp(`(^|[^a-záðéíóúýþæö])${n}`, 'i').test(t))).map((p) => p.id);
}

export function expandFeed(text, from, to) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch { /* þegar skráð */ }
  }

  const masters = new Map();
  const exceptions = [];
  for (const v of root.getAllSubcomponents('vevent')) {
    const e = new ICAL.Event(v);
    if (e.isRecurrenceException()) exceptions.push(e);
    else masters.set(e.uid, e);
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid);
    if (m) m.relateException(ex);
    else masters.set(ex.uid + '|' + ex.recurrenceId.toString(), ex);
  }

  const out = [];
  const push = (item, start, end) => {
    if (String(item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    const s = start.toJSDate(), e = (end || start).toJSDate();
    if (e <= from || s > to) return;
    const allDay = start.isDate;
    out.push({
      uid: item.uid,
      title: item.summary || '(án titils)',
      location: item.location || null,
      allDay,
      start: allDay ? start.toString() : s.toISOString(),
      end: allDay ? (end || start).toString() : e.toISOString(),
    });
  };

  const rangeEnd = ICAL.Time.fromJSDate(to, true);
  for (const ev of masters.values()) {
    if (!ev.isRecurring()) { push(ev, ev.startDate, ev.endDate); continue; }
    const it = ev.iterator();
    let next, n = 0;
    while ((next = it.next()) && next.compare(rangeEnd) <= 0 && n++ < 2000) {
      const d = ev.getOccurrenceDetails(next);
      push(d.item, d.startDate, d.endDate);
    }
  }
  return out;
}
