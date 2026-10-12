import { createBackend } from './data.js';
import { CALENDAR_FUNCTION } from './config.js';

const APP_VERSION = 'fv-v10';
import {
  DAYS, DAYS_SHORT, CATEGORIES, iso, fromIso, addDays, startOfWeek, isoWeek, longDate, weekRange,
  esc, hashPin, firstName, categorize,
} from './util.js';

const app = document.getElementById('app');
const ME_KEY = 'fv.me';

const state = {
  backend: null,
  profiles: [],
  me: null,
  tab: 'home',
  items: [],
  meals: {},                       // { 'YYYY-MM-DD': meal }
  weekStart: startOfWeek(new Date()),
  events: [],
  calStatus: 'idle',               // idle | loading | ok | error | not_setup
  calFailed: [],
  calFilter: 'allir',
  notices: [],
  unsub: [],
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ekkert */ } },
};

const profileById = (id) => state.profiles.find((p) => p.id === id);
const isParent = () => state.me?.role === 'parent';
const todayIso = () => iso(new Date());

// ==================================================================
// Ræsing
// ==================================================================
boot();

async function boot() {
  try {
    state.backend = await createBackend();
  } catch (e) {
    console.error(e);
    return renderError('Náði ekki að tengjast. Athugaðu nettenginguna og reyndu aftur.');
  }
  if (state.backend.needsLogin && !(await state.backend.getSession())) return renderLogin();
  await startProfiles();
}

async function startProfiles() {
  try {
    state.profiles = await state.backend.listProfiles();
  } catch (e) {
    console.error(e);
    return renderError('Gat ekki sótt prófíla. Er gagnagrunnurinn uppsettur?');
  }
  const saved = profileById(store.get(ME_KEY));
  if (saved) { state.me = saved; return startMain(); }
  renderPicker();
}

async function startMain() {
  state.calFilter = store.get('fv.calfilter') || 'allir';
  renderShell();
  await Promise.all([loadItems(), loadMeals(), loadNotices()]);
  renderView();
  loadEvents().then(() => refreshIf(['home', 'cal']));
  syncPush();

  state.unsub.forEach((u) => u());
  state.unsub = [
    state.backend.subscribe('shopping_items', async () => { await loadItems(); refreshIf(['home', 'shop']); }),
    state.backend.subscribe('meals', async () => { await loadMeals(); refreshIf(['home', 'menu']); }),
    state.backend.subscribe('notifications', async () => { await loadNotices(); refreshIf(['home']); }),
  ];
}

// Forsíðan uppfærist á mínútu fresti svo liðnir viðburðir detti út
setInterval(() => {
  if (state.me && state.tab === 'home' && document.visibilityState === 'visible') renderView();
}, 60000);

// Síminn vaknar (app opnað aftur af heimaskjá) → sækja nýjustu gögn
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !state.me) return;
  await Promise.all([loadItems(), loadMeals(), reloadProfiles(), loadNotices()]);
  renderView();
  await loadEvents();
  refreshIf(['home', 'cal']);
});

// Nýjar myndir annarra koma inn þegar appið er opnað aftur
async function reloadProfiles() {
  try {
    state.profiles = await state.backend.listProfiles();
    state.me = profileById(state.me.id) || state.me;
    const btn = document.getElementById('me-btn');
    if (btn) btn.innerHTML = avatar(state.me);
  } catch (e) { console.error(e); }
}

async function loadItems() {
  try { state.items = await state.backend.listItems(); } catch (e) { console.error(e); }
}

async function loadMeals() {
  const thisWeek = startOfWeek(new Date());
  const from = new Date(Math.min(thisWeek, state.weekStart));
  const to = addDays(new Date(Math.max(thisWeek, state.weekStart)), 6);
  try {
    const rows = await state.backend.listMeals(iso(from), iso(to));
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) delete state.meals[iso(d)];
    rows.forEach((m) => { state.meals[m.day] = m; });
  } catch (e) { console.error(e); }
}

// Dagatal: sótt frá Google í gegnum Supabase. Síðasta svar geymt í tækinu
// svo dagatalið birtist strax og líka án nets.
const CAL_KEY = 'fv.cal';
function calRange() {
  const thisWeek = startOfWeek(new Date());
  const from = new Date(Math.min(thisWeek, state.weekStart));
  const to = addDays(new Date(Math.max(thisWeek, state.weekStart)), 6);
  return [iso(from), iso(to)];
}

async function loadEvents() {
  const [from, to] = calRange();
  const key = from + '|' + to;
  if (state.calKey !== key) {
    try {
      const cached = JSON.parse(store.get(CAL_KEY) || 'null');
      if (cached?.key === key) { state.events = cached.events; state.calStatus = 'ok'; }
      else { state.events = []; state.calStatus = 'loading'; }
    } catch { state.calStatus = 'loading'; }
    state.calKey = key;
  }
  try {
    const res = await state.backend.listEvents(from, to);
    if (state.calKey !== key) return;          // vika breyttist á meðan
    state.events = res.events || [];
    state.calFailed = res.failed || [];
    state.calStatus = 'ok';
    store.set(CAL_KEY, JSON.stringify({ key, events: state.events }));
  } catch (e) {
    console.error(e);
    if (state.calKey !== key) return;
    state.calError = e.code || 'error';
    if (e.code === 'not_setup' || e.code === 'no_calendars') state.calStatus = 'not_setup';
    else if (state.calStatus !== 'ok') state.calStatus = 'error';
  }
}

function eventsOn(dayIso, filter = 'allir') {
  return state.events.filter((e) => {
    const onDay = e.allDay ? e.start <= dayIso && dayIso < e.end : iso(new Date(e.start)) === dayIso;
    if (!onDay) return false;
    return filter === 'allir' || e.people.includes(filter) || e.people.includes('allir');
  }).sort((a, b) => (b.allDay - a.allDay) || a.start.localeCompare(b.start));
}

const hhmm = (s) => { const d = new Date(s); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const eventTime = (e) => (e.allDay ? 'Allan daginn' : hhmm(e.start));

function eventPeople(e) {
  if (e.people.includes('allir')) return '<span class="who-all" title="Allir">👨‍👩‍👧‍👦</span>';
  return e.people.map((id) => avatar(profileById(id), 'sm')).join('');
}

function eventRow(e) {
  const main = profileById(e.people[0]);
  const color = e.people.includes('allir') || !main ? 'var(--accent)' : main.color;
  return `
    <li><button class="event" data-event="${esc(e.id)}" style="--c:${esc(color)}">
      <span class="ev-time">${esc(eventTime(e))}</span>
      <span class="ev-body"><span class="ev-title">${esc(e.title)}</span>
        ${e.location ? `<span class="ev-loc muted">${esc(e.location)}</span>` : ''}</span>
      <span class="ev-who">${eventPeople(e)}</span>
    </button></li>`;
}

function bindEvents(root) {
  root.querySelectorAll('[data-event]').forEach((b) =>
    b.addEventListener('click', () => openEventSheet(state.events.find((e) => e.id === b.dataset.event))));
}

function refreshIf(tabs) { if (tabs.includes(state.tab)) renderView(); }

// ==================================================================
// Innskráning fjölskyldu (einu sinni í hverjum síma)
// ==================================================================
function renderLogin(message = '') {
  app.innerHTML = `
    <section class="center-screen">
      <div class="brand-mark">🏠</div>
      <h1>Fjölskylduvikan</h1>
      <p class="muted">Skráðu fjölskylduaðganginn inn. Þetta þarf bara að gera einu sinni í hverjum síma.</p>
      <form class="stack" id="login">
        <label class="field"><span>Netfang</span>
          <input type="email" name="email" autocomplete="username" required inputmode="email"></label>
        <label class="field"><span>Lykilorð</span>
          <input type="password" name="password" autocomplete="current-password" required></label>
        ${message ? `<p class="error">${esc(message)}</p>` : ''}
        <button class="btn primary big" type="submit">Skrá inn</button>
      </form>
    </section>`;
  app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Augnablik…';
    try {
      await state.backend.signIn(f.get('email').trim(), f.get('password'));
      await startProfiles();
    } catch {
      renderLogin('Netfang eða lykilorð er rangt.');
    }
  });
}

function renderError(msg) {
  app.innerHTML = `
    <section class="center-screen">
      <div class="brand-mark">😕</div>
      <h1>Úbbs</h1>
      <p class="muted">${esc(msg)}</p>
      <button class="btn primary" onclick="location.reload()">Reyna aftur</button>
    </section>`;
}

// ==================================================================
// Hver ert þú? + PIN
// ==================================================================
function avatar(p, size = '') {
  if (!p) return `<span class="avatar ${size}" style="--c:#9CA3AF">?</span>`;
  if (p.photo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo)) {
    return `<span class="avatar photo ${size}" style="--c:${esc(p.color)}" aria-hidden="true"><img src="${p.photo}" alt=""></span>`;
  }
  return `<span class="avatar ${size}" style="--c:${esc(p.color)}" aria-hidden="true">${esc(p.emoji)}</span>`;
}

function renderPicker() {
  app.innerHTML = `
    <section class="center-screen">
      <h1>Hver ert þú?</h1>
      <p class="muted">Veldu þig. Appið man eftir þér í þessum síma.</p>
      <div class="picker">
        ${state.profiles.map((p) => `
          <button class="pick" data-id="${esc(p.id)}">
            ${avatar(p, 'xl')}
            <span>${esc(p.name)}</span>
          </button>`).join('')}
      </div>
      ${demoNote()}
    </section>`;
  app.querySelectorAll('.pick').forEach((b) =>
    b.addEventListener('click', () => renderPin(profileById(b.dataset.id))));
}

function renderPin(profile, { change = false, onDone } = {}) {
  let mode = profile.pin_hash && !change ? 'enter' : 'create';
  let first = '';
  let entry = '';
  let note = '';

  const title = () => ({
    enter: `Hæ ${firstName(profile.name)}!`,
    create: change ? 'Veldu nýtt PIN' : `Hæ ${firstName(profile.name)}! Veldu þér PIN`,
    confirm: 'Sláðu það aftur inn',
  }[mode]);
  const sub = () => ({
    enter: 'Sláðu inn PIN-ið þitt',
    create: '4 tölur sem þú manst',
    confirm: 'Til að vera viss',
  }[mode]);

  const finish = () => {
    if (onDone) return onDone();
    state.me = profile;
    store.set(ME_KEY, profile.id);
    startMain();
  };

  function draw(shake = false) {
    app.innerHTML = `
      <section class="center-screen pin-screen">
        <button class="link back" id="pin-back">‹ Til baka</button>
        ${avatar(profile, 'xl')}
        <h1>${esc(title())}</h1>
        <p class="muted">${esc(sub())}</p>
        <div class="pin-dots ${shake ? 'shake' : ''}" aria-label="${entry.length} af 4">
          ${[0, 1, 2, 3].map((i) => `<span class="${i < entry.length ? 'on' : ''}" style="--c:${esc(profile.color)}"></span>`).join('')}
        </div>
        <p class="error" aria-live="assertive">${esc(note)}</p>
        <div class="pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}
          <span></span><button data-n="0">0</button>
          <button data-del aria-label="Eyða">⌫</button>
        </div>
      </section>`;
    app.querySelector('#pin-back').addEventListener('click', () => (onDone ? onDone() : renderPicker()));
    app.querySelectorAll('.pad [data-n]').forEach((b) => b.addEventListener('click', () => press(b.dataset.n)));
    app.querySelector('.pad [data-del]').addEventListener('click', () => { entry = entry.slice(0, -1); note = ''; draw(); });
  }

  async function press(n) {
    if (entry.length >= 4) return;
    entry += n; note = '';
    draw();
    if (entry.length < 4) return;

    if (mode === 'enter') {
      if ((await hashPin(profile.id, entry)) === profile.pin_hash) return finish();
      entry = ''; note = 'Rangt PIN — reyndu aftur';
      return draw(true);
    }
    if (mode === 'create') {
      first = entry; entry = ''; mode = 'confirm';
      return setTimeout(draw, 150);
    }
    if (entry !== first) {
      mode = 'create'; first = ''; entry = ''; note = 'Passaði ekki — byrjum aftur';
      return draw(true);
    }
    const hash = await hashPin(profile.id, entry);
    try {
      await state.backend.setPin(profile.id, hash);
      profile.pin_hash = hash;
      if (change) toast('PIN-inu var breytt');
      finish();
    } catch {
      entry = ''; note = 'Gat ekki vistað — athugaðu netið';
      draw(true);
    }
  }

  draw();
}

function demoNote() {
  return state.backend?.mode === 'demo'
    ? `<p class="demo-note">Prufuútgáfa — gögnin vistast bara í þessu tæki.</p>` : '';
}

// ==================================================================
// Aðalskjár
// ==================================================================
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.2 0-4 2.7-4 7s1.8 4 4 4"/></svg>',
};
const TABS = [
  { id: 'home', label: 'Heim' },
  { id: 'cal', label: 'Dagatal' },
  { id: 'shop', label: 'Innkaup' },
  { id: 'menu', label: 'Matseðill' },
];

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <div class="title">Fjölskylduvikan</div>
      <div class="top-actions">
        ${isParent() ? `<button class="send-btn ${state.tab === 'home' ? '' : 'hidden'}" id="send-btn" aria-label="Senda tilkynningu">＋</button>` : ''}
        <button class="me-btn" id="me-btn" aria-label="Notandi: ${esc(state.me.name)}">${avatar(state.me)}</button>
      </div>
    </header>
    ${state.backend.mode === 'demo' ? '<div class="demo-banner">Prufuútgáfa — gögnin vistast bara í þessu tæki</div>' : ''}
    <main id="view"></main>
    <nav class="tabbar">
      ${TABS.map((t) => `
        <button data-tab="${t.id}" class="${state.tab === t.id ? 'active' : ''}">
          ${ICONS[t.id]}<span>${t.label}</span><i class="badge" data-badge="${t.id}"></i>
        </button>`).join('')}
    </nav>`;
  app.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  app.querySelector('#me-btn').addEventListener('click', openMeSheet);
  app.querySelector('#send-btn')?.addEventListener('click', openSendSheet);
}

function go(tab) {
  state.tab = tab;
  app.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  app.querySelector('#send-btn')?.classList.toggle('hidden', tab !== 'home');
  renderView();
  window.scrollTo({ top: 0 });
}

function renderView() {
  const view = document.getElementById('view');
  if (!view) return;
  ({ home: renderHome, cal: renderCal, shop: renderShop, menu: renderMenu }[state.tab])(view);
  const open = state.items.filter((i) => !i.checked).length;
  const badge = app.querySelector('[data-badge="shop"]');
  if (badge) badge.textContent = open ? String(open) : '';
}

// ------------------------------------------------------------------
// Heim
// ------------------------------------------------------------------
function renderHome(view) {
  const now = new Date();
  const greet = now.getHours() < 18 ? 'Góðan daginn' : 'Gott kvöld';
  const tonight = state.meals[todayIso()];
  const open = state.items.filter((i) => !i.checked);

  view.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(longDate(now))}</p>
      <h1>${greet}, ${esc(firstName(state.me.name))} ${esc(state.me.emoji)}</h1>
    </section>

    ${noticesCard()}
    ${pushPromptCard()}
    ${todayCard()}

    <button class="card tap tonight" data-go="menu">
      <div class="card-label">🍽️ Í kvöldmatinn</div>
      ${tonight
        ? `<div class="big-title">${esc(tonight.title)}</div>${tonight.notes ? `<p class="muted">${esc(tonight.notes)}</p>` : ''}`
        : `<div class="big-title muted">Ekkert ákveðið ennþá</div>
           <p class="muted">${isParent() ? 'Ýttu hér til að skipuleggja vikuna' : 'Mamma og pabbi eru að hugsa málið 🤔'}</p>`}
    </button>

    <button class="card tap" data-go="shop">
      <div class="card-head">
        <div class="card-label">🛒 Innkaupalisti</div>
        <span class="pill">${open.length ? `${open.length} eftir` : 'Allt komið'}</span>
      </div>
      ${open.length
        ? `<div class="chips">${open.slice(0, 6).map((i) => `<span class="chip">${esc(i.name)}</span>`).join('')}${open.length > 6 ? `<span class="chip more">+${open.length - 6}</span>` : ''}</div>`
        : '<p class="muted">Listinn er tómur. Vel gert! 🎉</p>'}
    </button>
    <p class="coming">Heimilisverk koma í næstu útgáfu ✨</p>`;

  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  bindEvents(view);
  view.querySelector('#push-yes')?.addEventListener('click', enablePush);
  view.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', () => {
    dismissNotice(b.dataset.dismiss);
    renderView();
  }));
  view.querySelector('#push-later')?.addEventListener('click', () => { store.set('fv.pushlater', String(Date.now())); renderView(); });
}

function todayCard() {
  // Börn sjá bara sína viðburði (og það sem er fyrir alla); foreldrar sjá alla.
  // Viðburðir sem eru búnir detta út; heilsdagsviðburðir standa allan daginn.
  const now = new Date();
  const mine = eventsOn(todayIso(), isParent() ? 'allir' : state.me.id);
  const today = mine.filter((e) => e.allDay || new Date(e.end) > now);
  let body;
  if (state.calStatus === 'loading') body = '<p class="muted">Sæki dagatalið…</p>';
  else if (state.calStatus === 'not_setup') body = '<p class="muted">Dagatalið er ekki tengt ennþá.</p>';
  else if (state.calStatus === 'error' && !today.length) body = '<p class="muted">Náði ekki í dagatalið — reyni aftur þegar netið kemur.</p>';
  else if (!today.length) body = mine.length
    ? '<p class="muted">Allt búið í dag ✅</p>'
    : '<p class="muted">Ekkert á dagskrá í dag 🌿</p>';
  else body = `<ul class="events compact">${today.slice(0, 6).map(eventRow).join('')}</ul>
    ${today.length > 6 ? `<p class="muted small">+${today.length - 6} í viðbót</p>` : ''}`;
  return `
    <section class="card">
      <div class="card-head">
        <div class="card-label">📅 Í dag</div>
        <button class="link small" data-go="cal">Vikan ›</button>
      </div>
      ${body}
    </section>`;
}

// ------------------------------------------------------------------
// Innkaupalisti
// ------------------------------------------------------------------
function renderShop(view) {
  if (!view.querySelector('#add-form')) {
    view.innerHTML = `
      <section class="hero compact"><h1>Innkaupalisti</h1></section>
      <form id="add-form" class="add-form" autocomplete="off">
        <input id="add-input" placeholder="Bæta á listann… (t.d. mjólk, egg)" aria-label="Vara" enterkeyhint="done">
        <button class="btn primary" type="submit" aria-label="Bæta við">＋</button>
      </form>
      <div id="shop-list"></div>`;
    view.querySelector('#add-form').addEventListener('submit', onAddItems);
  }
  renderShopList(view.querySelector('#shop-list'));
}

async function onAddItems(e) {
  e.preventDefault();
  const input = document.getElementById('add-input');
  const names = input.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (!names.length) return;
  input.value = '';
  const rows = names.map((n) => ({
    name: n.charAt(0).toUpperCase() + n.slice(1),
    category: categorize(n),
    added_by: state.me.id,
  }));
  try {
    await state.backend.addItems(rows);
    await loadItems(); renderView();
    if (rows.length > 1) toast(`${rows.length} vörum bætt við`);
  } catch { toast('Gat ekki bætt við — athugaðu netið'); input.value = names.join(', '); }
  input.focus();
}

function renderShopList(el) {
  const open = state.items.filter((i) => !i.checked);
  const done = state.items.filter((i) => i.checked)
    .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));

  const groups = CATEGORIES.map((c) => [c, open.filter((i) => (CATEGORIES.includes(i.category) ? i.category : 'Annað') === c)])
    .filter(([, list]) => list.length);

  const row = (i) => {
    const who = profileById(i.added_by);
    return `
      <li class="item ${i.checked ? 'checked' : ''}">
        <button class="check" data-toggle="${esc(i.id)}" aria-label="${i.checked ? 'Taka úr körfu' : 'Komið í körfu'}: ${esc(i.name)}">
          <span class="box">${i.checked ? '✓' : ''}</span>
          <span class="name">${esc(i.name)}</span>
        </button>
        <span class="by" title="${esc(who?.name || '')}">${avatar(who, 'sm')}</span>
        <button class="del" data-del="${esc(i.id)}" aria-label="Eyða ${esc(i.name)}">×</button>
      </li>`;
  };

  el.innerHTML = `
    ${!open.length && !done.length ? `
      <div class="empty"><div class="empty-mark">🧺</div><p>Listinn er tómur.</p>
      <p class="muted">Skrifaðu vöru hér að ofan — allir sjá hana strax.</p></div>` : ''}
    ${groups.map(([cat, list]) => `
      <section class="group">
        <h2 class="group-title">${esc(cat)}</h2>
        <ul class="items">${list.map(row).join('')}</ul>
      </section>`).join('')}
    ${done.length ? `
      <section class="group done">
        <div class="group-head">
          <h2 class="group-title">Komið í körfu (${done.length})</h2>
          <button class="link" id="clear-done">Hreinsa</button>
        </div>
        <ul class="items">${done.map(row).join('')}</ul>
      </section>` : ''}`;

  el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleItem(b.dataset.toggle)));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteItem(b.dataset.del)));
  el.querySelector('#clear-done')?.addEventListener('click', clearDone);
}

async function toggleItem(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  const checked = !it.checked;
  Object.assign(it, { checked, checked_by: checked ? state.me.id : null, checked_at: checked ? new Date().toISOString() : null });
  renderView();
  try {
    await state.backend.updateItem(id, { checked: it.checked, checked_by: it.checked_by, checked_at: it.checked_at });
  } catch { toast('Gat ekki vistað — athugaðu netið'); await loadItems(); renderView(); }
}

async function deleteItem(id) {
  const it = state.items.find((i) => i.id === id);
  state.items = state.items.filter((i) => i.id !== id);
  renderView();
  try {
    await state.backend.deleteItem(id);
    toast(`${it?.name || 'Vöru'} eytt`);
  } catch { toast('Gat ekki eytt — athugaðu netið'); await loadItems(); renderView(); }
}

async function clearDone() {
  state.items = state.items.filter((i) => !i.checked);
  renderView();
  try { await state.backend.clearChecked(); } catch { toast('Gat ekki hreinsað'); await loadItems(); renderView(); }
}

// ------------------------------------------------------------------
// Matseðill vikunnar
// ------------------------------------------------------------------
function renderMenu(view) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(state.weekStart, n));

  view.innerHTML = `
    <section class="hero compact"><h1>Matseðill</h1></section>
    ${weekNav()}
    <ul class="menu-days">
      ${days.map((d) => {
        const key = iso(d);
        const m = state.meals[key];
        const today = key === todayIso();
        return `
          <li>
            <button class="card tap day-card ${today ? 'today' : ''} ${m ? '' : 'empty-day'}" data-day="${key}">
              <div class="day-name">${DAYS[d.getDay()]} <span class="muted">${d.getDate()}.</span>${today ? '<span class="pill accent">Í dag</span>' : ''}</div>
              ${m
                ? `<div class="meal-title">${esc(m.title)}</div>${m.notes ? `<p class="muted small">${esc(m.notes)}</p>` : ''}`
                : `<div class="meal-title muted">${isParent() ? '＋ Bæta við máltíð' : 'Ekkert ákveðið'}</div>`}
            </button>
          </li>`;
      }).join('')}
    </ul>`;

  bindWeekNav(view);
  view.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => openMealSheet(b.dataset.day)));
}

async function shiftWeek(n) {
  state.weekStart = addDays(state.weekStart, n);
  renderView();
  await Promise.all([loadMeals(), loadEvents()]);
  renderView();
}

function weekNav() {
  const monday = state.weekStart;
  const thisWeek = iso(startOfWeek(new Date())) === iso(monday);
  return `
    <div class="week-nav">
      <button class="icon-btn" id="prev-week" aria-label="Fyrri vika">‹</button>
      <div class="week-label">
        <strong>${thisWeek ? 'Þessi vika' : `Vika ${isoWeek(monday)}`}</strong>
        <span class="muted">${esc(weekRange(monday))}</span>
      </div>
      <button class="icon-btn" id="next-week" aria-label="Næsta vika">›</button>
    </div>`;
}

function bindWeekNav(view) {
  view.querySelector('#prev-week').addEventListener('click', () => shiftWeek(-7));
  view.querySelector('#next-week').addEventListener('click', () => shiftWeek(7));
}

// ------------------------------------------------------------------
// Dagatal
// ------------------------------------------------------------------
function renderCal(view) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(state.weekStart, n));
  const f = state.calFilter;
  const chip = (id, label, color, icon) => `
    <button class="filter ${f === id ? 'on' : ''}" data-filter="${esc(id)}" style="--c:${esc(color)}">
      ${icon}<span>${esc(label)}</span></button>`;

  let body;
  if (state.calStatus === 'not_setup') {
    const why = state.calError === 'no_calendars'
      ? 'Fallið fannst, en leynilegu iCal-slóðirnar (ICAL_HEIMILID / ICAL_ODDUR) vantar í Supabase → Edge Functions → Secrets.'
      : `Fann ekki dagatalsfallið „${esc(CALENDAR_FUNCTION)}“ í Supabase → Edge Functions.`;
    body = `<div class="empty"><div class="empty-mark">🔌</div><p>Dagatalið er ekki tengt ennþá</p>
      <p class="muted">${why}</p><button class="btn" id="cal-retry">Reyna aftur</button>
      <p class="muted small">Útgáfa ${APP_VERSION}</p></div>`;
  } else if (state.calStatus === 'loading') {
    body = '<div class="empty"><div class="empty-mark">📅</div><p class="muted">Sæki dagatalið…</p></div>';
  } else if (state.calStatus === 'error' && !state.events.length) {
    body = `<div class="empty"><div class="empty-mark">📡</div><p>Náði ekki í dagatalið</p>
      <button class="btn" id="cal-retry">Reyna aftur</button></div>`;
  } else {
    body = `<div class="cal-days">${days.map((d) => {
      const key = iso(d);
      const list = eventsOn(key, f);
      const today = key === todayIso();
      return `
        <section class="cal-day ${today ? 'today' : ''}">
          <h2 class="cal-day-title">${DAYS[d.getDay()]} <span class="muted">${d.getDate()}.</span>${today ? '<span class="pill accent">Í dag</span>' : ''}</h2>
          ${list.length ? `<ul class="events">${list.map(eventRow).join('')}</ul>` : '<p class="muted small cal-none">Ekkert á dagskrá</p>'}
        </section>`;
    }).join('')}</div>
    ${state.calFailed.length ? '<p class="muted small">⚠️ Náði ekki í öll dagatölin núna — reyni aftur seinna.</p>' : ''}
    <p class="coming">Viðburðum er bætt við í Google Calendar. Settu nafnið fremst í titilinn,<br>t.d. „Alma – fimleikar“, þá fer hann á rétta manneskju.</p>`;
  }

  view.innerHTML = `
    <section class="hero compact"><h1>Dagatal</h1></section>
    <div class="filters" role="tablist" aria-label="Sýna dagatal fyrir">
      ${chip('allir', 'Allir', 'var(--accent)', '<span class="avatar sm" style="--c:var(--accent)">👨‍👩‍👧‍👦</span>')}
      ${state.profiles.map((p) => chip(p.id, firstName(p.name), p.color, avatar(p, 'sm'))).join('')}
    </div>
    ${weekNav()}
    ${body}`;

  bindWeekNav(view);
  bindEvents(view);
  view.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    state.calFilter = b.dataset.filter;
    store.set('fv.calfilter', state.calFilter);
    renderView();
  }));
  view.querySelector('#cal-retry')?.addEventListener('click', async () => {
    state.calStatus = 'loading'; renderView(); await loadEvents(); renderView();
  });
}

function openEventSheet(e) {
  if (!e) return;
  const start = e.allDay ? fromIso(e.start) : new Date(e.start);
  let when;
  if (e.allDay) {
    const last = addDays(fromIso(e.end), -1);
    when = iso(last) === e.start ? `${longDate(start)} · allan daginn`
      : `${longDate(start)} – ${longDate(last)}`;
  } else {
    when = `${longDate(start)} · ${hhmm(e.start)}–${hhmm(e.end)}`;
  }
  const who = e.people.includes('allir')
    ? '<span class="who-row">👨‍👩‍👧‍👦 Öll fjölskyldan</span>'
    : e.people.map((id) => { const p = profileById(id); return p ? `<span class="who-row">${avatar(p, 'sm')} ${esc(p.name)}</span>` : ''; }).join('');
  openSheet(`
    <h2>${esc(e.title)}</h2>
    <p class="muted">${esc(when)}</p>
    ${e.location ? `<p>📍 ${esc(e.location)}</p>` : ''}
    <div class="who-list">${who}</div>
    <div class="sheet-actions"><button class="btn" data-close>Loka</button></div>`);
}

function openMealSheet(day) {
  const m = state.meals[day];
  const d = fromIso(day);
  const heading = `${DAYS[d.getDay()]} ${d.getDate()}.`;

  if (!isParent()) {
    if (!m) return toast('Ekkert ákveðið þennan dag ennþá');
    const s = openSheet(`
      <p class="eyebrow">${esc(heading)}</p>
      <h2>${esc(m.title)}</h2>
      ${m.notes ? `<p>${esc(m.notes)}</p>` : ''}
      ${ingredientList(m)}
      <div class="sheet-actions">
        ${m.ingredients?.length ? '<button class="btn primary" id="to-list">🛒 Setja hráefni á listann</button>' : ''}
        <button class="btn" data-close>Loka</button>
      </div>`);
    s.el.querySelector('#to-list')?.addEventListener('click', async () => { await addIngredients(m.ingredients); s.close(); });
    return;
  }

  const s = openSheet(`
    <p class="eyebrow">${esc(heading)}</p>
    <h2>${m ? 'Breyta máltíð' : 'Ný máltíð'}</h2>
    <form id="meal-form" class="stack">
      <label class="field"><span>Hvað er í matinn?</span>
        <input name="title" required value="${esc(m?.title || '')}" placeholder="t.d. Kjötsúpa"></label>
      <label class="field"><span>Athugasemd <em class="muted">(valfrjálst)</em></span>
        <input name="notes" value="${esc(m?.notes || '')}" placeholder="t.d. Afi kemur í mat"></label>
      <label class="field"><span>Hráefni <em class="muted">(eitt í hverja línu)</em></span>
        <textarea name="ingredients" rows="5" placeholder="Lambakjöt&#10;Kartöflur&#10;Gulrófur">${esc((m?.ingredients || []).join('\n'))}</textarea></label>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Vista</button>
        <button class="btn" type="button" id="save-and-list">Vista + setja á listann</button>
        ${m ? '<button class="btn danger-text" type="button" id="del-meal">Eyða</button>' : ''}
      </div>
    </form>`);

  const form = s.el.querySelector('#meal-form');
  const save = async (andList) => {
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    const ingredients = String(f.get('ingredients')).split('\n').map((x) => x.trim()).filter(Boolean);
    const meal = {
      day, title: String(f.get('title')).trim(), notes: String(f.get('notes')).trim() || null,
      ingredients, updated_by: state.me.id, updated_at: new Date().toISOString(),
    };
    try {
      await state.backend.saveMeal(meal);
      state.meals[day] = { ...(m || {}), ...meal };
      s.close(); renderView();
      if (andList && ingredients.length) await addIngredients(ingredients);
      else toast('Vistað');
    } catch { toast('Gat ekki vistað — athugaðu netið'); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  s.el.querySelector('#save-and-list').addEventListener('click', () => save(true));
  s.el.querySelector('#del-meal')?.addEventListener('click', async () => {
    try {
      await state.backend.deleteMeal(day);
      delete state.meals[day];
      s.close(); renderView(); toast('Máltíð eytt');
    } catch { toast('Gat ekki eytt'); }
  });
  setTimeout(() => form.querySelector('input[name=title]').focus(), 250);
}

function ingredientList(m) {
  if (!m.ingredients?.length) return '';
  return `<div class="card-label">Hráefni</div>
    <ul class="ingredients">${m.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

async function addIngredients(list) {
  const have = new Set(state.items.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
  const rows = list.filter((n) => !have.has(n.toLowerCase()))
    .map((name) => ({ name, category: categorize(name), added_by: state.me.id }));
  if (!rows.length) return toast('Allt er nú þegar á listanum 👍');
  try {
    await state.backend.addItems(rows);
    await loadItems(); renderView();
    const skipped = list.length - rows.length;
    toast(`${rows.length} ${rows.length === 1 ? 'vöru' : 'vörum'} bætt á listann${skipped ? ` (${skipped} voru þar fyrir)` : ''}`);
  } catch { toast('Gat ekki bætt á listann'); }
}

// ------------------------------------------------------------------
// "Ég" — skipta um notanda, PIN o.fl.
// ------------------------------------------------------------------
function openMeSheet() {
  const others = state.profiles.filter((p) => p.id !== state.me.id && p.pin_hash);
  const s = openSheet(`
    <div class="me-head">${avatar(state.me, 'lg')}<div><h2>${esc(state.me.name)}</h2>
      <p class="muted">${isParent() ? 'Foreldri' : 'Fjölskyldumeðlimur'}</p></div></div>
    <div class="menu-list">
      <label class="menu-file">📷 ${state.me.photo ? 'Skipta um mynd' : 'Setja inn mynd af mér'}
        <input type="file" accept="image/*" id="photo-input" hidden></label>
      ${state.me.photo ? '<button id="remove-photo">↩️ Nota emoji í staðinn</button>' : ''}
      <button id="switch-user">🔄 Skipta um notanda</button>
      ${pushMenuRow()}
      <button id="change-pin">🔢 Breyta PIN-inu mínu</button>
      ${isParent() && others.length ? `
        <div class="card-label">Gleymt PIN? Endurstilla fyrir:</div>
        ${others.map((p) => `<button data-reset="${esc(p.id)}">${avatar(p, 'sm')} ${esc(p.name)}</button>`).join('')}` : ''}
      ${state.backend.mode === 'live' ? '<button id="sign-out" class="danger-text">Skrá fjölskylduaðgang út úr þessum síma</button>' : ''}
    </div>`);

  s.el.querySelector('#photo-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    s.close();
    openPhotoEditor(file);
  });
  s.el.querySelector('#remove-photo')?.addEventListener('click', async () => {
    s.close();
    await savePhoto(null);
  });
  s.el.querySelector('#enable-push')?.addEventListener('click', async () => { s.close(); await enablePush(); });
  s.el.querySelector('#switch-user').addEventListener('click', () => {
    s.close(); store.set(ME_KEY, null); state.me = null; state.tab = 'home'; renderPicker();
  });
  s.el.querySelector('#change-pin').addEventListener('click', () => {
    s.close();
    renderPin(state.me, { change: true, onDone: () => { renderShell(); renderView(); } });
  });
  s.el.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
    const p = profileById(b.dataset.reset);
    try {
      await state.backend.setPin(p.id, null);
      p.pin_hash = null; s.close();
      toast(`${firstName(p.name)} velur nýtt PIN næst`);
    } catch { toast('Gat ekki endurstillt'); }
  }));
  s.el.querySelector('#sign-out')?.addEventListener('click', async () => {
    await state.backend.signOut(); store.set(ME_KEY, null); location.reload();
  });
}

// ------------------------------------------------------------------
// Prófílmynd: velja úr myndasafni, færa og stækka í hringnum, vista litla
// ------------------------------------------------------------------
function openPhotoEditor(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); toast('Gat ekki opnað myndina'); };
  img.onload = () => {
    const SIZE = 600;
    let zoom = 1, ox = 0, oy = 0;
    const s = openSheet(`
      <h2>Stilltu myndina</h2>
      <p class="muted">Dragðu til að færa · notaðu sleðann til að stækka</p>
      <div class="crop" style="--c:${esc(state.me.color)}"><canvas width="${SIZE}" height="${SIZE}"></canvas></div>
      <label class="zoom"><span>－</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Stækka"><span>＋</span></label>
      <div class="sheet-actions">
        <button class="btn primary" id="photo-save">Vista mynd</button>
        <button class="btn" data-close>Hætta við</button>
      </div>`);
    const canvas = s.el.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const base = Math.max(SIZE / img.width, SIZE / img.height);

    const clamp = () => {
      const dw = img.width * base * zoom, dh = img.height * base * zoom;
      const mx = (dw - SIZE) / 2, my = (dh - SIZE) / 2;
      ox = Math.max(-mx, Math.min(mx, ox));
      oy = Math.max(-my, Math.min(my, oy));
    };
    const draw = () => {
      clamp();
      const sc = base * zoom, dw = img.width * sc, dh = img.height * sc;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (SIZE - dw) / 2 + ox, (SIZE - dh) / 2 + oy, dw, dh);
    };
    draw();

    s.el.querySelector('input[type=range]').addEventListener('input', (e) => { zoom = Number(e.target.value); draw(); });

    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, ox, oy };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = SIZE / canvas.getBoundingClientRect().width;
      ox = drag.ox + (e.clientX - drag.x) * k;
      oy = drag.oy + (e.clientY - drag.y) * k;
      draw();
    });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    s.el.querySelector('#photo-save').addEventListener('click', async () => {
      const out = document.createElement('canvas');
      out.width = out.height = 256;
      out.getContext('2d').drawImage(canvas, 0, 0, SIZE, SIZE, 0, 0, 256, 256);
      const data = out.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(url);
      s.close();
      await savePhoto(data);
    });
  };
  img.src = url;
}

async function savePhoto(photo) {
  try {
    await state.backend.setPhoto(state.me.id, photo);
    state.me.photo = photo;
    const p = profileById(state.me.id);
    if (p) p.photo = photo;
    renderShell(); renderView();
    toast(photo ? 'Ný mynd komin 📸' : 'Emoji-ið er komið aftur');
  } catch (e) {
    console.error(e);
    toast(e.code === 'no_column' ? 'Það þarf að uppfæra gagnagrunninn fyrst (2-myndir.sql)' : 'Gat ekki vistað myndina — athugaðu netið');
  }
}

// ------------------------------------------------------------------
// Tilkynningar
// ------------------------------------------------------------------
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function loadNotices() {
  try { state.notices = await state.backend.listNotices(new Date(Date.now() - 86400000).toISOString()); }
  catch (e) { state.notices = []; }          // taflan ekki til ennþá → engin skilaboð
}

function relTime(s) {
  const min = Math.round((Date.now() - new Date(s)) / 60000);
  if (min < 1) return 'rétt í þessu';
  if (min < 60) return `fyrir ${min} mín`;
  const h = Math.round(min / 60);
  return h < 24 ? `fyrir ${h} klst` : 'í gær';
}

// Lokuð skilaboð: geymd í símanum fyrir hvern notanda
const dismissKey = () => 'fv.dismissed.' + state.me.id;
function dismissed() {
  try { return JSON.parse(store.get(dismissKey()) || '[]'); } catch { return []; }
}
function dismissNotice(id) {
  const keep = new Set(state.notices.map((n) => n.id));        // gleyma gömlum sem eru horfin hvort sem er
  const list = dismissed().filter((x) => keep.has(x));
  list.push(id);
  store.set(dismissKey(), JSON.stringify(list));
}

function noticesCard() {
  const hidden = new Set(dismissed());
  const mine = state.notices.filter((n) => (!n.to_id || n.to_id === state.me.id) && !hidden.has(n.id)).slice(0, 3);
  if (!mine.length) return '';
  return `
    <section class="card notices">
      <div class="card-label">📣 Skilaboð</div>
      <ul class="notice-list">
        ${mine.map((n) => {
          const from = profileById(n.from_id);
          return `<li>${avatar(from, 'sm')}<div class="notice-text"><p class="notice-body">${esc(n.body)}</p>
            <p class="muted small">${esc(from ? firstName(from.name) : '')}${n.to_id ? ' · bara til þín' : ''} · ${esc(relTime(n.created_at))}</p></div>
            <button class="notice-close" data-dismiss="${esc(n.id)}" aria-label="Loka skilaboðum">×</button></li>`;
        }).join('')}
      </ul>
    </section>`;
}

function pushPromptCard() {
  if (state.backend.mode !== 'live' || !pushSupported() || !isStandalone()) return '';
  if (Notification.permission !== 'default') return '';
  const later = Number(store.get('fv.pushlater') || 0);
  if (Date.now() - later < 3 * 86400000) return '';
  return `
    <section class="card push-prompt">
      <div class="card-label">🔔 Tilkynningar</div>
      <p>${isParent() ? 'Fáðu skilaboð sem send eru á fjölskylduna.' : 'Kveiktu á tilkynningum svo þú missir ekki af skilaboðum frá mömmu og pabba.'}</p>
      <div class="row-actions">
        <button class="btn primary" id="push-yes">Kveikja á tilkynningum</button>
        <button class="btn" id="push-later">Seinna</button>
      </div>
    </section>`;
}

function pushMenuRow() {
  if (state.backend.mode !== 'live') return '';
  if (!pushSupported()) {
    return isIOS() && !isStandalone()
      ? '<p class="menu-note">🔔 Opnaðu appið af heimaskjánum til að geta fengið tilkynningar.</p>'
      : '<p class="menu-note">🔔 Þessi vafri styður ekki tilkynningar.</p>';
  }
  if (Notification.permission === 'granted') return '<p class="menu-note">🔔 Kveikt á tilkynningum í þessum síma</p>';
  if (Notification.permission === 'denied') {
    return '<p class="menu-note">🔕 Tilkynningar eru bannaðar. Leyfðu þær í Stillingum símans → Tilkynningar → Fjölskyldan.</p>';
  }
  return '<button id="enable-push">🔔 Kveikja á tilkynningum</button>';
}

async function enablePush() {
  if (!pushSupported()) {
    toast(isIOS() && !isStandalone() ? 'Opnaðu appið af heimaskjánum fyrst' : 'Þessi sími styður ekki tilkynningar');
    return;
  }
  let perm;
  try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
  if (perm !== 'granted') {
    toast('Tilkynningar ekki leyfðar — hægt að breyta í Stillingum símans');
    renderView();
    return;
  }
  try {
    await subscribePush();
    toast('Kveikt á tilkynningum 🔔');
  } catch (e) {
    console.error(e);
    toast(e.code === 'not_setup' ? 'Það þarf að uppfæra þjóninn fyrst' : 'Gat ekki kveikt á tilkynningum — reyndu aftur');
  }
  renderView();
}

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribePush() {
  const key = await state.backend.pushPublicKey();
  if (!key) return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await state.backend.savePushSubscription(state.me.id, sub);
}

// Við hverja opnun: tengja síma þessa notanda (líka eftir „Skipta um notanda“)
function syncPush() {
  if (state.backend.mode !== 'live' || !pushSupported() || Notification.permission !== 'granted') return;
  subscribePush().catch((e) => console.error('push sync', e));
}

const QUICK = ['Matur er tilbúinn! 🍽️', 'Komið heim 🏠', 'Ég er á leiðinni 🚗', 'Munið að taka til 🧹', 'Kominn tími á háttinn 😴'];

function openSendSheet() {
  if (!isParent()) return;
  let to = 'allir';
  const people = state.profiles.filter((p) => p.id !== state.me.id);
  const s = openSheet(`
    <h2>📣 Senda tilkynningu</h2>
    <div class="card-label">Til</div>
    <div class="filters wrap" id="to-list">
      <button class="filter on" data-to="allir" style="--c:var(--accent)"><span class="avatar sm" style="--c:var(--accent)">👨‍👩‍👧‍👦</span><span>Allir</span></button>
      ${people.map((p) => `<button class="filter" data-to="${esc(p.id)}" style="--c:${esc(p.color)}">${avatar(p, 'sm')}<span>${esc(firstName(p.name))}</span></button>`).join('')}
    </div>
    <label class="field"><span>Skilaboð</span>
      <textarea id="notice-text" rows="3" maxlength="300" placeholder="Skrifaðu skilaboð…"></textarea></label>
    <div class="chips">${QUICK.map((q) => `<button class="chip quick" type="button">${esc(q)}</button>`).join('')}</div>
    <div class="sheet-actions">
      <button class="btn primary big" id="send-notice">Senda á alla</button>
      <button class="btn" data-close>Hætta við</button>
    </div>`);

  const btn = s.el.querySelector('#send-notice');
  const text = s.el.querySelector('#notice-text');
  const label = () => {
    const p = profileById(to);
    btn.textContent = to === 'allir' ? 'Senda á alla' : `Senda á ${firstName(p.name)}`;
  };
  s.el.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
    to = b.dataset.to;
    s.el.querySelectorAll('[data-to]').forEach((x) => x.classList.toggle('on', x === b));
    label();
  }));
  s.el.querySelectorAll('.quick').forEach((b) => b.addEventListener('click', () => { text.value = b.textContent; text.focus(); }));

  btn.addEventListener('click', async () => {
    const body = text.value.trim();
    if (!body) { text.focus(); return toast('Skrifaðu skilaboð fyrst'); }
    btn.disabled = true; btn.textContent = 'Sendi…';
    try {
      const res = await state.backend.sendNotice(state.me.id, to, body);
      s.close();
      await loadNotices(); renderView();
      const who = to === 'allir' ? null : firstName(profileById(to).name);
      if (state.backend.mode === 'demo') toast('Sent (prufuútgáfa — engin tilkynning fer í síma)');
      else if (!res.devices) toast(who ? `Vistað — en ${who} hefur ekki kveikt á tilkynningum` : 'Vistað — enginn hefur kveikt á tilkynningum ennþá');
      else toast(`Sent 📣 (${res.sent} af ${res.devices} ${res.devices === 1 ? 'síma' : 'símum'})`);
    } catch (e) {
      console.error(e);
      btn.disabled = false; label();
      toast(e.code === 'parents_only' ? 'Aðeins foreldrar geta sent tilkynningar'
        : e.code === 'not_setup' || e.code === 'bad_range' ? 'Það þarf að uppfæra þjóninn í Supabase fyrst'
          : 'Gat ekki sent — athugaðu netið');
    }
  });
  setTimeout(() => text.focus(), 250);
}

// ==================================================================
// Smáhlutir: blað neðan frá, skilaboð
// ==================================================================
function openSheet(inner) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${inner}</div>`;
  document.body.append(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 220);
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  return { el: wrap.querySelector('.sheet'), close };
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// Service worker: appið opnast hratt og virkar þó netið sé slappt
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
