// Fjölskylduvikan — dagatal
// Supabase Edge Function sem les Google-dagatöl fjölskyldunnar (leynileg iCal-slóð)
// og skilar viðburðum á tilteknu tímabili, merktum þeim sem þeir tilheyra.
//
// Leyndarmál (Supabase → Edge Functions → Secrets):
//   ICAL_HEIMILID  – leynileg iCal-slóð "Heimilið"
//   ICAL_ODDUR     – leynileg iCal-slóð "Heimilið vol.2" (oddurhelgi@gmail.com)

import ICAL from 'npm:ical.js@2.2.1';
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

  // Aðeins innskráður fjölskylduaðgangur fær dagatalið
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const auth = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'));
  const { data: who, error: authError } = await auth.auth.getUser(token);
  if (authError || !who?.user) return json({ error: 'not_signed_in' }, 401);

  let from, to;
  try {
    const body = await req.json();
    from = new Date(body.from + 'T00:00:00Z');
    to = new Date(body.to + 'T23:59:59Z');
    if (isNaN(from) || isNaN(to) || to - from > 62 * 86400000) throw new Error('range');
  } catch {
    return json({ error: 'bad_range' }, 400);
  }

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
});

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
