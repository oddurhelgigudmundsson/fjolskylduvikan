// Gagnalag: Supabase þegar lykill er settur inn, annars prufuhamur (localStorage).
import { SUPABASE_URL, SUPABASE_ANON_KEY, CALENDAR_FUNCTION } from './config.js';

export async function createBackend() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return supabaseBackend();
  return demoBackend();
}

// ------------------------------------------------------------------
// Supabase (raunverulegt, deilt á milli allra síma)
// ------------------------------------------------------------------
async function supabaseBackend() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fv.auth' },
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };

  return {
    mode: 'live',
    needsLogin: true,
    async getSession() { const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },

    async listProfiles() { return ok(await sb.from('profiles').select('*').order('sort')); },
    async setPin(id, pin_hash) { ok(await sb.from('profiles').update({ pin_hash }).eq('id', id)); },

    async listItems() { return ok(await sb.from('shopping_items').select('*').order('created_at')); },
    async addItems(rows) { ok(await sb.from('shopping_items').insert(rows)); },
    async updateItem(id, patch) { ok(await sb.from('shopping_items').update(patch).eq('id', id)); },
    async deleteItem(id) { ok(await sb.from('shopping_items').delete().eq('id', id)); },
    async clearChecked() { ok(await sb.from('shopping_items').delete().eq('checked', true)); },

    async listMeals(from, to) {
      return ok(await sb.from('meals').select('*').gte('day', from).lte('day', to).order('day'));
    },
    async saveMeal(meal) { ok(await sb.from('meals').upsert(meal, { onConflict: 'day' })); },
    async deleteMeal(day) { ok(await sb.from('meals').delete().eq('day', day)); },

    // Dagatal: Edge Function (sjá CALENDAR_FUNCTION í config.js) les Google-dagatölin
    async listEvents(from, to) {
      const { data, error } = await sb.functions.invoke(CALENDAR_FUNCTION || 'calendar', { body: { from, to } });
      if (error) {
        let code = 'error';
        try { code = (await error.context?.json())?.error || code; } catch { /* ekkert */ }
        if (error.context?.status === 404) code = 'not_setup';
        throw Object.assign(new Error('calendar'), { code });
      }
      return data;
    },

    subscribe(table, cb) {
      const ch = sb.channel('rt-' + table)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => cb())
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

// ------------------------------------------------------------------
// Prufuhamur: allt í localStorage, svo hægt sé að skoða appið strax
// ------------------------------------------------------------------
function demoBackend() {
  const KEY = 'fv.demo.v1';
  const listeners = {};
  let memory = null;

  const read = () => {
    if (memory) return memory;
    try { memory = JSON.parse(localStorage.getItem(KEY)); } catch { memory = null; }
    if (!memory) { memory = seed(); write(); }
    return memory;
  };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* minni dugar */ } };
  const emit = (table) => (listeners[table] || []).forEach((cb) => cb());
  const commit = (table) => { write(); emit(table); };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  return {
    mode: 'demo',
    needsLogin: false,
    async getSession() { return { demo: true }; },
    async signIn() {},
    async signOut() {},

    async listProfiles() { return clone(read().profiles); },
    async setPin(id, pin_hash) {
      const p = read().profiles.find((x) => x.id === id);
      if (p) p.pin_hash = pin_hash;
      commit('profiles');
    },

    async listItems() { return clone(read().items); },
    async addItems(rows) {
      const now = Date.now();
      rows.forEach((r, i) => read().items.push({
        id: uid(), checked: false, checked_by: null, checked_at: null,
        created_at: new Date(now + i).toISOString(), ...r,
      }));
      commit('shopping_items');
    },
    async updateItem(id, patch) {
      const it = read().items.find((x) => x.id === id);
      if (it) Object.assign(it, patch);
      commit('shopping_items');
    },
    async deleteItem(id) {
      read().items = read().items.filter((x) => x.id !== id);
      commit('shopping_items');
    },
    async clearChecked() {
      read().items = read().items.filter((x) => !x.checked);
      commit('shopping_items');
    },

    async listMeals(from, to) {
      return clone(read().meals.filter((m) => m.day >= from && m.day <= to).sort((a, b) => a.day.localeCompare(b.day)));
    },
    async saveMeal(meal) {
      const meals = read().meals;
      const i = meals.findIndex((m) => m.day === meal.day);
      if (i >= 0) meals[i] = { ...meals[i], ...meal };
      else meals.push({ id: uid(), ...meal });
      commit('meals');
    },
    async deleteMeal(day) {
      read().meals = read().meals.filter((m) => m.day !== day);
      commit('meals');
    },

    async listEvents(from, to) {
      return { events: demoEvents().filter((e) => e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to), failed: [] };
    },

    subscribe(table, cb) {
      (listeners[table] ||= []).push(cb);
      const onStorage = (e) => { if (e.key === KEY) { memory = null; cb(); } };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners[table] = listeners[table].filter((x) => x !== cb);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function demoEvents() {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const at = (dayN, h, m = 0) => { const d = new Date(monday); d.setDate(d.getDate() + dayN); d.setHours(h, m); return d.toISOString(); };
  const dateOnly = (dayN) => {
    const d = new Date(monday); d.setDate(d.getDate() + dayN);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const list = [];
  const ev = (title, people, start, end, allDay = false, location = null) =>
    list.push({ id: title + start, uid: title, title, people, start, end, allDay, location });
  for (let w = -1; w <= 2; w++) {
    const o = w * 7;
    ev('Fótboltaæfing Pétur', ['petur'], at(o + 0, 16, 30), at(o + 0, 18), false, 'KR-völlur');
    ev('Fótboltaæfing Pétur', ['petur'], at(o + 2, 16, 30), at(o + 2, 18), false, 'KR-völlur');
    ev('Alma – fimleikar', ['alma'], at(o + 1, 17), at(o + 1, 18, 30));
    ev('Alma – fimleikar', ['alma'], at(o + 3, 17), at(o + 3, 18, 30));
    ev('Thelma – píanó', ['thelma'], at(o + 2, 15), at(o + 2, 15, 45));
    ev('Kristín vinnukvöld', ['kristin'], at(o + 3, 19), at(o + 3, 22));
    ev('Oddur – dómari', ['oddur'], at(o + 5, 13), at(o + 5, 15), false, 'Laugardalsvöllur');
  }
  ev('Thelma Tannréttingar', ['thelma'], at(1, 13, 50), at(1, 14, 20));
  ev('Klilla', ['allir'], at(2, 12), at(2, 13));
  ev('Sumarbústaður', ['allir'], dateOnly(5), dateOnly(7), true);
  return list.sort((a, b) => a.start.localeCompare(b.start));
}

function seed() {
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const day = (n) => {
    const d = new Date(monday); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const t = Date.now();
  const item = (name, category, added_by, i, checked = false) => ({
    id: uid(), name, category, added_by, checked, checked_by: checked ? 'kristin' : null,
    checked_at: checked ? new Date().toISOString() : null, created_at: new Date(t - (20 - i) * 60000).toISOString(),
  });
  return {
    profiles: [
      { id: 'oddur',   name: 'Oddur',       role: 'parent', color: '#2563EB', emoji: '🏃', pin_hash: null, sort: 1 },
      { id: 'kristin', name: 'Kristín',     role: 'parent', color: '#DB2777', emoji: '🌸', pin_hash: null, sort: 2 },
      { id: 'alma',    name: 'Alma Rún',    role: 'child',  color: '#7C3AED', emoji: '🦄', pin_hash: null, sort: 3 },
      { id: 'thelma',  name: 'Thelma Lind', role: 'child',  color: '#059669', emoji: '🌿', pin_hash: null, sort: 4 },
      { id: 'petur',   name: 'Pétur Ingi',  role: 'child',  color: '#EA580C', emoji: '⚽', pin_hash: null, sort: 5 },
    ],
    items: [
      item('Mjólk', 'Mjólkurvörur og egg', 'kristin', 1),
      item('Skyr', 'Mjólkurvörur og egg', 'alma', 2),
      item('Bananar', 'Ávextir og grænmeti', 'petur', 3),
      item('Rúgbrauð', 'Brauð og bakkelsi', 'oddur', 4),
      item('Kjúklingabringur', 'Kjöt og fiskur', 'kristin', 5),
      item('Tannkrem', 'Hreinlæti og heimili', 'thelma', 6),
      item('Egg', 'Mjólkurvörur og egg', 'oddur', 7, true),
    ],
    meals: [
      { id: uid(), day: day(0), title: 'Plokkfiskur með rúgbrauði', notes: '', ingredients: ['Ýsa', 'Kartöflur', 'Laukur', 'Rúgbrauð'], updated_by: 'kristin' },
      { id: uid(), day: day(1), title: 'Kjúklingavefjur', notes: 'Pétur vill extra ost', ingredients: ['Kjúklingabringur', 'Tortillur', 'Rifinn ostur', 'Salat', 'Salsa'], updated_by: 'oddur' },
      { id: uid(), day: day(2), title: 'Lasagna', notes: '', ingredients: ['Nautahakk', 'Lasagnaplötur', 'Tómatsósa', 'Mozzarella'], updated_by: 'kristin' },
      { id: uid(), day: day(4), title: 'Pizzakvöld 🍕', notes: 'Allir velja álegg', ingredients: ['Pizzabotn', 'Pizzasósa', 'Pepperoni', 'Rifinn ostur'], updated_by: 'oddur' },
    ],
  };
}
