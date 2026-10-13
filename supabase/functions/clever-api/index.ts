// Fjölskylduvikan — þjónn (Supabase Edge Function "clever-api")
// 1) Dagatal: les Google-dagatöl fjölskyldunnar (leynileg iCal-slóð) og skilar
//    viðburðum á tilteknu tímabili, merktum þeim sem þeir tilheyra.
// 2) Tilkynningar: foreldrar senda skilaboð á einn eða alla (Web Push).
// 3) Áminningar: klukka í gagnagrunninum (pg_cron) kallar hér á 5 mín fresti
//    og áminningar sem eiga að fara núna eru sendar í síma viðkomandi.
// 4) Heimilisverk: foreldrar fá tilkynningu þegar verk bíður samþykkis, og börnin
//    þegar það er samþykkt. (Sigurvegara vikunnar tilkynna foreldrarnir sjálfir.)
// 5) Saman: sá sem fær hrós fær tilkynningu, og kl. 18 fá allir áminningu ef
//    engin mynd dagsins er komin. Útrunnum story-myndum (24 klst) er eytt.
//
// Leyndarmál (Supabase → Edge Functions → Secrets): eitt fyrir hvert dagatal.
//   ICAL_<eitthvað>  – leynileg iCal-slóð dagatals (Google, iCloud, Outlook…)
//   Ef <eitthvað> er auðkenni prófíls (t.d. ICAL_ODDUR → 'oddur') eiga viðburðir án
//   nafns í titli þá manneskju; annars alla fjölskylduna (t.d. ICAL_FJOLSKYLDA).
// Lyklar fyrir tilkynningar búa sig til sjálfir í fyrsta skipti (tafla app_settings).

import ICAL from 'npm:ical.js@2.2.1';
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Hvaða dagatöl eru lesin: öll leyndarmál sem byrja á ICAL_.
// "fallback" = hver á viðburðinn ef ekkert nafn er í titlinum.
function feedsFor(profileIds) {
  return Object.entries(Deno.env.toObject())
    .filter(([k, v]) => k.startsWith('ICAL_') && v)
    .map(([k, v]) => {
      const id = k.slice(5).toLowerCase();
      return { secret: k, url: v.trim().replace(/^webcal:/i, 'https:'), fallback: profileIds.includes(id) ? [id] : ['allir'] };
    })
    // Sameiginleg dagatöl fyrst: sami viðburður í tveimur dagatölum fer þá á alla
    .sort((a, b) => (a.fallback[0] === 'allir' ? 0 : 1) - (b.fallback[0] === 'allir' ? 0 : 1) || a.secret.localeCompare(b.secret));
}

// Nöfn sem þekkjast í titli viðburðar → prófíll í appinu. Lesið úr prófílunum:
// fornafnið og gælunöfn í dálkinum "aliases" (t.d. Gummi, Birni), hvert með
// algengum beygingum (Odds, Pétri, Thelmu, Ölmu, Kristínar, Gumma).
// Orðið í titlinum þarf að vera nafnið + beygingarending, svo „annað“ er ekki „Anna“.
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae');
function formsOf(word) {
  const w = word.toLowerCase();
  const out = [];
  if (/ur$/.test(w) && w.length > 4) out.push([w.slice(0, -2), ['ur', 'urs', 'ar', 'i', 'ri', 's', '']]);   // Oddur, Pétur, Guðmundur
  else if (/a$/.test(w) && w.length > 3) {                                                           // Alma, Anna, Thelma
    const stem = w.slice(0, -1);
    out.push([stem, ['a', 'u']]);
    const i = stem.lastIndexOf('a');
    if (i >= 0) out.push([stem.slice(0, i) + 'ö' + stem.slice(i + 1), ['u']]);                         // Ölmu, Önnu
  } else if (/i$/.test(w) && w.length > 3) out.push([w.slice(0, -1), ['i', 'a']]);                    // Helgi, Gummi
  else out.push([w, ['', 's', 'i', 'u', 'ar']]);                                                       // Jón, Kristín
  return out;
}
export function namesFor(profile) {
  const words = [String(profile.name || '').trim().split(/\s+/)[0], ...(profile.aliases || [])]
    .map((w) => String(w || '').trim()).filter(Boolean);
  const out = [];
  for (const w of words) for (const [base, endings] of formsOf(w)) {
    out.push({ base, endings });
    if (fold(base) !== base) out.push({ base: fold(base), endings });   // skrifað án kommu: Petur, Kristin
  }
  return out;
}

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
      const out = await runReminders();
      out.photoNudge = await photoNudge();
      out.stories = await cleanupStories();
      return json(out);
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
    if (body.action === 'kudos') return await kudosPush(body);
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
// Saman: hrós og mynd dagsins
// ------------------------------------------------------------------
async function kudosPush({ kudos_id }) {
  const db = admin();
  const { data: k } = await db.from('kudos').select('*').eq('id', kudos_id).maybeSingle();
  if (!k) return json({ ok: true, sent: 0 });
  const { data: from } = await db.from('profiles').select('name').eq('id', k.from_id).maybeSingle();
  const name = String(from?.name || '').split(' ')[0];
  let sent = 0;
  if (k.to_id) {
    sent = (await pushTo(db, k.to_id, { title: `${k.emoji} ${name} hrósaði þér`, body: k.body, tag: 'kudos-' + k.id, url: './' })).sent;
  } else {
    const { data: everyone } = await db.from('profiles').select('id').neq('id', k.from_id);
    for (const p of everyone || []) {
      sent += (await pushTo(db, p.id, { title: `${k.emoji} ${name} hrósaði fjölskyldunni`, body: k.body, tag: 'kudos-' + k.id, url: './' })).sent;
    }
  }
  return json({ ok: true, sent });
}

// Kl. 18:00 (eða næsta keyrsla eftir það): ef engin mynd dagsins er komin
async function photoNudge() {
  const now = icelandNow();
  if (now.minutes < 18 * 60 || now.minutes >= 19 * 60) return null;
  const db = admin();
  const { data: today } = await db.from('photos').select('id').eq('day', now.day).limit(1);
  if (today?.length) return { skipped: 'has_photo' };
  const mark = await db.from('app_settings').insert({ key: 'photo-nudge-' + now.day, value: { at: new Date().toISOString() } });
  if (mark.error) return null;                                     // þegar sent í dag
  const r = await pushTo(db, null, { title: '📸 Mynd dagsins', body: 'Engin mynd dagsins ennþá — hver tekur hana?', tag: 'photo-' + now.day, url: './' });
  return { sent: r.sent };
}

// Story lifir í 24 klst: útrunnar myndir fjarlægðar úr geymslunni og töflunni
async function cleanupStories() {
  const db = admin();
  const { data, error } = await db.from('stories').select('id, path').lt('expires_at', new Date().toISOString()).limit(200);
  if (error || !data?.length) return error ? { error: error.message } : { removed: 0 };
  await db.storage.from('myndir').remove(data.map((s) => s.path));
  await db.from('stories').delete().in('id', data.map((s) => s.id));
  return { removed: data.length };
}

// ------------------------------------------------------------------
// Dagatal
// ------------------------------------------------------------------
async function calendar(body) {
  const from = new Date(body.from + 'T00:00:00Z');
  const to = new Date(body.to + 'T23:59:59Z');
  if (isNaN(from) || isNaN(to) || to - from > 62 * 86400000) return json({ error: 'bad_range' }, 400);

  const { data: profiles } = await admin().from('profiles').select('*');
  const people = (profiles || []).map((p) => ({ id: p.id, names: namesFor(p) }));
  const feeds = feedsFor(people.map((p) => p.id));
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
      const who = whoIsIt(ev.title, people);
      events.push({ ...ev, id: key, people: who.length ? who : feed.fallback });
    }
  });

  events.sort((a, b) => a.start.localeCompare(b.start));
  return json({ events, failed });
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const L = 'a-záðéíóúýþæö';
export function whoIsIt(title, people) {
  const t = ' ' + String(title || '').toLowerCase() + ' ';
  return people.filter((p) => p.names.some(({ base, endings }) =>
    new RegExp(`(^|[^${L}])${escRe(base)}(${endings.map(escRe).join('|')})(?=[^${L}]|$)`).test(t))).map((p) => p.id);
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
