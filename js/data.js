// Gagnalag: Supabase þegar lykill er settur inn, annars prufuhamur (localStorage).
import { authKey } from './family.js';

// family = { code, url, key, fn } úr config.js, eða null → prufuhamur
export async function createBackend(family) {
  if (family?.url && family?.key) return supabaseBackend(family);
  return demoBackend();
}

// ------------------------------------------------------------------
// Supabase (raunverulegt, deilt á milli allra síma)
// ------------------------------------------------------------------
async function supabaseBackend(family) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(family.url, family.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: authKey(family) },
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const callFn = async (body) => {
    const { data, error } = await sb.functions.invoke(family.fn || 'clever-api', { body });
    if (error) {
      let code = 'error';
      try { code = (await error.context?.json())?.error || code; } catch { /* ekkert */ }
      if (error.context?.status === 404) code = 'not_setup';
      throw Object.assign(new Error(code), { code });
    }
    return data;
  };

  return {
    mode: 'live',
    needsLogin: true,
    async getSession() { const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },

    async listProfiles() { return ok(await sb.from('profiles').select('*').order('sort')); },
    async setPin(id, pin_hash) { ok(await sb.from('profiles').update({ pin_hash }).eq('id', id)); },
    async setPhoto(id, photo) {
      const { data, error } = await sb.from('profiles').update({ photo }).eq('id', id).select('id');
      if (error) throw Object.assign(error, { code: /photo/.test(error.message || '') ? 'no_column' : error.code });
      if (!data?.length) throw new Error('not_saved');
    },

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

    // Þjónninn (Edge Function, sjá fn í config.js): dagatal + tilkynningar
    async listEvents(from, to) { return callFn({ from, to }); },
    async pushPublicKey() { return (await callFn({ action: 'vapid' })).publicKey; },
    async sendNotice(from, to, body) { return callFn({ action: 'send', from, to, body }); },
    async savePushSubscription(profileId, sub) {
      const j = sub.toJSON();
      ok(await sb.from('push_subscriptions').upsert({
        endpoint: j.endpoint, profile_id: profileId, p256dh: j.keys.p256dh, auth: j.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200), updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' }));
    },
    // ---- Saman: myndir, hrós, óskalistar ----
    async listPhotos(from) {
      return ok(await sb.from('photos').select('*').gte('day', from).order('day', { ascending: false }).order('created_at'));
    },
    async listReactions(ids) {
      if (!ids.length) return [];
      return ok(await sb.from('photo_reactions').select('*').in('photo_id', ids));
    },
    async addPhoto({ profile_id, day, caption, taken_at, blob }) {
      const path = `${day.slice(0, 4)}/${day}/${profile_id}-${Date.now()}.jpg`;
      ok(await sb.storage.from('myndir').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      const old = ok(await sb.from('photos').select('id, path').eq('profile_id', profile_id).eq('day', day));
      if (old.length) {
        await sb.storage.from('myndir').remove(old.map((o) => o.path));
        ok(await sb.from('photos').delete().in('id', old.map((o) => o.id)));
      }
      ok(await sb.from('photos').insert({ profile_id, day, caption, taken_at, path }));
    },
    async deletePhoto(photo) {
      await sb.storage.from('myndir').remove([photo.path]);
      ok(await sb.from('photos').delete().eq('id', photo.id));
    },
    async photoUrls(paths) {
      if (!paths.length) return {};
      const data = ok(await sb.storage.from('myndir').createSignedUrls(paths, 60 * 60 * 6));
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
    async react(photo_id, profile_id, emoji) {
      if (emoji) ok(await sb.from('photo_reactions').upsert({ photo_id, profile_id, emoji }, { onConflict: 'photo_id,profile_id' }));
      else ok(await sb.from('photo_reactions').delete().match({ photo_id, profile_id }));
    },
    // ---- Story: myndir sem lifa í 24 klst ----
    async listStories() {
      return ok(await sb.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at'));
    },
    async listStoryReactions(ids) {
      if (!ids.length) return [];
      return ok(await sb.from('story_reactions').select('*').in('story_id', ids));
    },
    async addStory({ profile_id, blob }) {
      const path = `story/${profile_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      ok(await sb.storage.from('myndir').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      ok(await sb.from('stories').insert({ profile_id, path }));
    },
    async deleteStory(story) {
      await sb.storage.from('myndir').remove([story.path]);
      ok(await sb.from('stories').delete().eq('id', story.id));
    },
    async reactStory(story_id, profile_id, emoji) {
      if (emoji) ok(await sb.from('story_reactions').upsert({ story_id, profile_id, emoji }, { onConflict: 'story_id,profile_id' }));
      else ok(await sb.from('story_reactions').delete().match({ story_id, profile_id }));
    },
    async listKudos(since) {
      return ok(await sb.from('kudos').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(100));
    },
    async addKudos(row) { return ok(await sb.from('kudos').insert(row).select('id').single()).id; },
    async kudosPush(id) { return callFn({ action: 'kudos', kudos_id: id }); },
    async listWishes() { return ok(await sb.from('wishes').select('*').order('starred', { ascending: false }).order('created_at')); },
    async saveWish(w) {
      const { id, ...row } = w;
      if (id) ok(await sb.from('wishes').update(row).eq('id', id));
      else ok(await sb.from('wishes').insert(row));
    },
    async deleteWish(id) { ok(await sb.from('wishes').delete().eq('id', id)); },

    // ---- Upplýsingabók ----
    async listInfo() { return ok(await sb.from('info_items').select('*').order('sort').order('created_at')); },
    async saveInfo(item) {
      const { id, ...row } = item;
      if (id) ok(await sb.from('info_items').update(row).eq('id', id));
      else ok(await sb.from('info_items').insert(row));
    },
    async deleteInfo(id) { ok(await sb.from('info_items').delete().eq('id', id)); },
    async listBirthdays() { return ok(await sb.from('birthdays').select('*').order('month').order('day')); },
    async saveBirthday(b) {
      const { id, ...row } = b;
      if (id) ok(await sb.from('birthdays').update(row).eq('id', id));
      else ok(await sb.from('birthdays').insert(row));
    },
    async deleteBirthday(id) { ok(await sb.from('birthdays').delete().eq('id', id)); },
    async setProfileBirthday(id, birthday) {
      const { data, error } = await sb.from('profiles').update({ birthday }).eq('id', id).select('id');
      if (error) throw Object.assign(error, { code: /birthday/.test(error.message || '') ? 'no_column' : error.code });
      if (!data?.length) throw new Error('not_saved');
    },
    async listSizes() { return ok(await sb.from('sizes').select('*')); },
    async saveSizes(row) { ok(await sb.from('sizes').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })); },

    async listChores() { return ok(await sb.from('chores').select('*').order('sort').order('created_at')); },
    async saveChore(c) {
      const { id, ...row } = c;
      if (id) ok(await sb.from('chores').update(row).eq('id', id));
      else ok(await sb.from('chores').insert(row));
    },
    async deleteChore(id) { ok(await sb.from('chores').delete().eq('id', id)); },
    async listChoreLogs(from, to) {
      return ok(await sb.from('chore_log').select('*').gte('day', from).lte('day', to));
    },
    async addChoreLog(row) { return ok(await sb.from('chore_log').insert(row).select('id').single()).id; },
    async deleteChoreLog(id) { ok(await sb.from('chore_log').delete().eq('id', id)); },
    async choreDone(logId) { return callFn({ action: 'chore_done', log_id: logId }); },
    async choreReview(logId, approve, by) { return callFn({ action: 'chore_review', log_id: logId, approve, by }); },

    async listReminders() { return ok(await sb.from('reminders').select('*').order('created_at')); },
    async saveReminder(r) {
      const { id, ...row } = r;
      if (id) ok(await sb.from('reminders').update(row).eq('id', id));
      else ok(await sb.from('reminders').insert(row));
    },
    async deleteReminder(id) { ok(await sb.from('reminders').delete().eq('id', id)); },
    async listDone(day) { return ok(await sb.from('reminder_done').select('reminder_id, profile_id').eq('day', day)); },
    async setDone(reminder_id, day, profile_id, done) {
      if (done) ok(await sb.from('reminder_done').upsert({ reminder_id, day, profile_id }, { onConflict: 'reminder_id,day,profile_id' }));
      else ok(await sb.from('reminder_done').delete().match({ reminder_id, day, profile_id }));
    },

    async listNotices(since) {
      return ok(await sb.from('notifications').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(20));
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
    async setPhoto(id, photo) {
      const p = read().profiles.find((x) => x.id === id);
      if (p) p.photo = photo;
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

    async pushPublicKey() { return null; },
    async savePushSubscription() {},
    async sendNotice(from, to, body) {
      (read().notices ||= []).push({ id: uid(), from_id: from, to_id: to === 'allir' ? null : to, body, created_at: new Date().toISOString() });
      commit('notifications');
      return { ok: true, sent: 0, devices: 0 };
    },
    // ---- Saman (prufuhamur) ----
    async listPhotos(from) {
      const d = read();
      if (!d.photos) { d.photos = []; d.reactions = []; write(); }
      return clone(d.photos.filter((p) => p.day >= from).sort((a, b) => b.day.localeCompare(a.day) || a.created_at.localeCompare(b.created_at)));
    },
    async listReactions(ids) { return clone((read().reactions || []).filter((r) => ids.includes(r.photo_id))); },
    async addPhoto({ profile_id, day, caption, taken_at, blob }) {
      const path = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const d = read();
      d.photos = (d.photos || []).filter((p) => !(p.profile_id === profile_id && p.day === day));
      d.photos.push({ id: uid(), profile_id, day, caption, taken_at, path, created_at: new Date().toISOString() });
      commit('photos');
    },
    async deletePhoto(photo) { read().photos = read().photos.filter((p) => p.id !== photo.id); commit('photos'); },
    async photoUrls(paths) { return Object.fromEntries(paths.map((p) => [p, p])); },
    async react(photo_id, profile_id, emoji) {
      const d = read();
      d.reactions = (d.reactions || []).filter((r) => !(r.photo_id === photo_id && r.profile_id === profile_id));
      if (emoji) d.reactions.push({ photo_id, profile_id, emoji });
      commit('photo_reactions');
    },
    async listStories() {
      const d = read(); const now = new Date().toISOString();
      if (!d.stories) { d.stories = []; d.storyReactions = []; write(); }
      return clone(d.stories.filter((x) => x.expires_at > now).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    },
    async listStoryReactions(ids) { return clone((read().storyReactions || []).filter((r) => ids.includes(r.story_id))); },
    async addStory({ profile_id, blob }) {
      const path = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const now = Date.now();
      (read().stories ||= []).push({ id: uid(), profile_id, path, created_at: new Date(now).toISOString(), expires_at: new Date(now + 864e5).toISOString() });
      commit('stories');
    },
    async deleteStory(story) { read().stories = read().stories.filter((x) => x.id !== story.id); commit('stories'); },
    async reactStory(story_id, profile_id, emoji) {
      const d = read();
      d.storyReactions = (d.storyReactions || []).filter((r) => !(r.story_id === story_id && r.profile_id === profile_id));
      if (emoji) d.storyReactions.push({ story_id, profile_id, emoji });
      commit('story_reactions');
    },
    async listKudos(since) {
      const d = read();
      if (!d.kudos) { d.kudos = demoKudos(); write(); }
      return clone(d.kudos.filter((k) => k.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async addKudos(row) { const id = uid(); (read().kudos ||= []).push({ id, created_at: new Date().toISOString(), ...row }); commit('kudos'); return id; },
    async kudosPush() { return { ok: true, sent: 0 }; },
    async listWishes() {
      const d = read();
      if (!d.wishes) { d.wishes = demoWishes(); write(); }
      return clone(d.wishes);
    },
    async saveWish(w) {
      const list = (read().wishes ||= []);
      const i = w.id ? list.findIndex((x) => x.id === w.id) : -1;
      if (i >= 0) list[i] = { ...list[i], ...w };
      else list.push({ claimed_by: null, starred: false, ...w, id: uid(), created_at: new Date().toISOString() });
      commit('wishes');
    },
    async deleteWish(id) { read().wishes = read().wishes.filter((x) => x.id !== id); commit('wishes'); },

    async listInfo() { const d = read(); if (!d.info) { Object.assign(d, demoBook()); write(); } return clone(d.info); },
    async saveInfo(item) {
      const d = read();
      if (item.id) Object.assign(d.info.find((x) => x.id === item.id) || {}, item);
      else d.info.push({ id: uid(), sort: 0, created_at: new Date().toISOString(), parents_only: false, ...item });
      commit('info_items');
    },
    async deleteInfo(id) { read().info = read().info.filter((x) => x.id !== id); commit('info_items'); },
    async listBirthdays() { const d = read(); if (!d.birthdays) { Object.assign(d, demoBook()); write(); } return clone(d.birthdays); },
    async saveBirthday(b) {
      const d = read();
      if (b.id) Object.assign(d.birthdays.find((x) => x.id === b.id) || {}, b);
      else d.birthdays.push({ id: uid(), created_at: new Date().toISOString(), ...b });
      commit('birthdays');
    },
    async deleteBirthday(id) { read().birthdays = read().birthdays.filter((x) => x.id !== id); commit('birthdays'); },
    async setProfileBirthday(id, birthday) {
      const p = read().profiles.find((x) => x.id === id);
      if (p) p.birthday = birthday;
      commit('profiles');
    },
    async listSizes() { const d = read(); if (!d.sizes) { Object.assign(d, demoBook()); write(); } return clone(d.sizes); },
    async saveSizes(row) {
      const d = read();
      d.sizes = d.sizes.filter((x) => x.profile_id !== row.profile_id);
      d.sizes.push({ ...row, updated_at: new Date().toISOString() });
      commit('sizes');
    },

    async listChores() {
      const d = read();
      if (!d.chores) { d.chores = demoChores(); d.clog = demoChoreLog(d.chores); write(); }
      return clone(d.chores);
    },
    async saveChore(c) {
      const list = (read().chores ||= []);
      const i = c.id ? list.findIndex((x) => x.id === c.id) : -1;
      if (i >= 0) list[i] = { ...list[i], ...c };
      else list.push({ ...c, id: uid(), sort: list.length + 1 });
      commit('chores');
    },
    async deleteChore(id) {
      read().chores = (read().chores || []).filter((x) => x.id !== id);
      read().clog = (read().clog || []).filter((x) => x.chore_id !== id);
      commit('chores');
    },
    async listChoreLogs(from, to) { return clone((read().clog || []).filter((l) => l.day >= from && l.day <= to)); },
    async addChoreLog(row) {
      const d = read();
      if ((d.clog ||= []).some((l) => l.chore_id === row.chore_id && l.day === row.day && l.profile_id === row.profile_id)) throw new Error('dup');
      const id = uid();
      d.clog.push({ id, approved_by: null, created_at: new Date().toISOString(), ...row });
      commit('chore_log');
      return id;
    },
    async deleteChoreLog(id) { read().clog = (read().clog || []).filter((l) => l.id !== id); commit('chore_log'); },
    async choreDone() { return { ok: true, sent: 0 }; },
    async choreReview(logId, approve, by) {
      const d = read();
      if (approve) { const l = d.clog.find((x) => x.id === logId); if (l) Object.assign(l, { status: 'approved', approved_by: by }); }
      else d.clog = d.clog.filter((x) => x.id !== logId);
      commit('chore_log');
      return { ok: true };
    },

    async listReminders() {
      const d = read();
      if (!d.reminders) { d.reminders = demoReminders(); write(); }
      return clone(d.reminders);
    },
    async saveReminder(r) {
      const list = (read().reminders ||= []);
      const i = r.id ? list.findIndex((x) => x.id === r.id) : -1;
      if (i >= 0) list[i] = { ...list[i], ...r };
      else list.push({ ...r, id: uid(), created_at: new Date().toISOString() });
      commit('reminders');
    },
    async deleteReminder(id) {
      read().reminders = (read().reminders || []).filter((x) => x.id !== id);
      commit('reminders');
    },
    async listDone(day) { return clone((read().rdone || []).filter((x) => x.day === day)); },
    async setDone(reminder_id, day, profile_id, done) {
      const d = read();
      d.rdone = (d.rdone || []).filter((x) => !(x.reminder_id === reminder_id && x.day === day && x.profile_id === profile_id));
      if (done) d.rdone.push({ reminder_id, day, profile_id });
      commit('reminder_done');
    },

    async listNotices(since) {
      return clone((read().notices || []).filter((n) => n.created_at >= since).reverse());
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

function demoKudos() {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  return [
    { id: uid(), from_id: 'alma', to_id: 'petur', emoji: '💪', body: 'Geggjað mark á æfingunni í dag!', created_at: ago(40) },
    { id: uid(), from_id: 'kristin', to_id: 'thelma', emoji: '🙏', body: 'Takk fyrir að ganga frá eftir matinn', created_at: ago(300) },
    { id: uid(), from_id: 'oddur', to_id: null, emoji: '💛', body: 'Takk öll fyrir frábæra helgi', created_at: ago(60 * 26) },
  ];
}

function demoWishes() {
  const w = (owner_id, title, extra = {}) => ({ id: uid(), owner_id, title, url: null, price: null, note: null, starred: false, claimed_by: null, created_at: new Date().toISOString(), ...extra });
  return [
    w('petur', 'Fótboltaskór (Nike Mercurial)', { price: 24990, note: 'Stærð 40', starred: true, url: 'https://www.example.com', claimed_by: 'kristin' }),
    w('petur', 'Lego Technic bíll', { price: 12990 }),
    w('petur', 'KR treyja 2027', { price: 9990, starred: true }),
    w('alma', 'Airpods', { price: 29990, starred: true }),
    w('alma', 'Bók: Harry Potter safn', { note: 'Íslensk útgáfa' }),
    w('thelma', 'Nótnabók fyrir píanó', { price: 4990 }),
    w('oddur', 'Hlaupaúr (Coros)', { price: 69990, starred: true, claimed_by: 'alma' }),
  ];
}

function demoChores() {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const c = (title, emoji, points, mode, needs_approval, repeat_days, sort) =>
    ({ id: uid(), title, emoji, points, mode, needs_approval, to_ids: [], repeat_days, sort });
  const today = new Date().getDay();
  return [
    c('Búa um rúmið', '🛏️', 5, 'each', false, all, 1),
    c('Draga frá gluggunum', '🪟', 3, 'each', false, all, 2),
    c('Taka til í herberginu', '🧸', 15, 'each', true, [3, 0, today], 3),
    c('Ryksuga herbergið sitt', '🧹', 15, 'each', true, [6], 4),
    c('Fara út með ruslið', '🗑️', 10, 'anyone', true, all, 5),
    c('Taka úr uppþvottavélinni', '🍽️', 10, 'anyone', true, all, 6),
  ];
}

// Smá saga svo stigataflan sé ekki tóm í prufuham
function demoChoreLog(chores) {
  const out = [];
  const monday = new Date(); monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const dayIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const kids = { alma: [1, 1, 1, 0, 1, 0], thelma: [1, 0, 1, 1, 0, 1], petur: [1, 1, 0, 0, 1, 0] };
  for (let back = 1; back <= 7; back++) {                     // síðasta vika
    const d = new Date(monday); d.setDate(d.getDate() - back);
    for (const [kid, pattern] of Object.entries(kids)) {
      chores.forEach((ch, i) => {
        if (!pattern[i] || (back + i + kid.length) % 3 === 0) return;
        if (ch.mode === 'anyone' && out.some((l) => l.chore_id === ch.id && l.day === dayIso(d))) return;
        out.push({ id: uid(), chore_id: ch.id, profile_id: kid, day: dayIso(d), status: 'approved', points: ch.points, approved_by: 'oddur' });
      });
    }
  }
  const today = dayIso(new Date());
  out.push({ id: uid(), chore_id: chores[0].id, profile_id: 'alma', day: today, status: 'approved', points: 5, approved_by: null });
  out.push({ id: uid(), chore_id: chores[4].id, profile_id: 'thelma', day: today, status: 'pending', points: 10, approved_by: null });
  out.push({ id: uid(), chore_id: chores[0].id, profile_id: 'thelma', day: today, status: 'approved', points: 5, approved_by: null });
  return out;
}

function demoReminders() {
  const today = new Date().getDay();
  const r = (to_id, body, repeat_days, remind_at, created_by = 'oddur') =>
    ({ id: uid(), to_id, body, repeat_days, once_date: null, remind_at, created_by, created_at: new Date().toISOString() });
  return [
    r('petur', 'Sunddót í skólann 🏊', [5], '07:30:00'),
    r('petur', 'Takkaskór á æfingu ⚽', [1, 3, today], '15:30:00'),
    r('alma', 'Fimleikaföt í töskuna 🤸', [2, 4, today], '07:30:00', 'kristin'),
    r('thelma', 'Æfa píanó 🎹', [1, 2, 3, 4, 5], null, 'thelma'),
    r(null, 'Taka ruslið út 🗑️', [today], '19:00:00', 'kristin'),
  ];
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

// Upplýsingabókin í prufuham: eitt WiFi, einn kóði bara fyrir foreldra, afmæli í dag
function demoBook() {
  const now = new Date();
  return {
    info: [
      { id: uid(), kind: 'wifi', title: 'Heimilið', value: 'sumar-i-reykjavik', parents_only: false, sort: 1, created_at: now.toISOString() },
      { id: uid(), kind: 'code', title: 'Lyklabox við útidyr', value: '4821', parents_only: true, sort: 2, created_at: now.toISOString() },
    ],
    birthdays: [
      { id: uid(), name: 'Amma Sigga', month: now.getMonth() + 1, day: now.getDate(), year: 1951, created_at: now.toISOString() },
      { id: uid(), name: 'Afi Jón', month: 3, day: 14, year: 1948, created_at: now.toISOString() },
    ],
    sizes: [
      { profile_id: 'alma', clothes: '146', pants: '146', shoes: '36', other: null },
      { profile_id: 'petur', clothes: 'M', pants: '30/32', shoes: '43', other: 'Takkaskór 43' },
    ],
  };
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
      { id: 'alma',    name: 'Alma Rún',    role: 'child',  color: '#7C3AED', emoji: '🦄', pin_hash: null, sort: 3, birthday: '2015-05-20' },
      { id: 'thelma',  name: 'Thelma Lind', role: 'child',  color: '#059669', emoji: '🌿', pin_hash: null, sort: 4, birthday: '2013-02-08' },
      { id: 'petur',   name: 'Pétur Ingi',  role: 'child',  color: '#EA580C', emoji: '⚽', pin_hash: null, sort: 5, birthday: '2010-08-30' },
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
