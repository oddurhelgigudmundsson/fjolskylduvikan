import { createBackend } from './data.js';
import { icon } from './icons.js';
import { jokeOfTheDay } from './jokes.js';
import { initStories, loadStories, storiesBar, bindStories } from './story.js';
import { resolveFamily, chooseFamily, forgetFamily, familyCount } from './family.js';

const APP_VERSION = 'fv-v28';
import {
  DAYS, DAYS_SHORT, MONTHS, CATEGORIES, iso, fromIso, addDays, startOfWeek, isoWeek, longDate, weekRange,
  esc, hashPin, firstName, categorize,
} from './util.js';

const app = document.getElementById('app');
const ME_KEY = 'fv.me';

const state = {
  family: null,                    // { code, name, url, key, fn } úr config.js
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
  reminders: [],
  chores: [],
  choreLogs: [],                  // síðasta vika + þessi vika
  photos: [],
  reactions: [],
  stories: [],                    // story: lifir í 24 klst
  storyReactions: [],
  photoUrls: {},                  // slóð í geymslu → undirrituð slóð
  photoDays: 62,                  // hversu langt aftur myndir eru sóttar
  kudos: [],
  wishes: [],
  wishPerson: null,
  remDone: new Set(),             // 'reminderId|profileId' fyrir daginn í dag
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
  const family = resolveFamily();
  if (family === 'ask') return renderFamilyCode();
  state.family = family;
  try {
    state.backend = await createBackend(family);
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
  initStories({
    state, store, backend: state.backend, avatar, profileById, isParent, toast, openSheet, shrinkPhoto,
    renderView: () => refreshIf(['home']),
  });
  state.calFilter = store.get('fv.calfilter') || 'allir';
  renderShell();
  await Promise.all([loadItems(), loadMeals(), loadNotices(), loadReminders(), loadChores()]);
  renderView();
  Promise.all([loadPhotos(), loadKudos(), loadWishes(), loadStories()]).then(() => refreshIf(['home', 'photos', 'kudos', 'wishes']));
  loadEvents().then(() => refreshIf(['home', 'cal']));
  syncPush();

  state.unsub.forEach((u) => u());
  state.unsub = [
    state.backend.subscribe('shopping_items', async () => { await loadItems(); refreshIf(['home', 'shop']); }),
    state.backend.subscribe('meals', async () => { await loadMeals(); refreshIf(['home', 'menu']); }),
    state.backend.subscribe('notifications', async () => { await loadNotices(); refreshIf(['home']); }),
    state.backend.subscribe('reminders', async () => { await loadReminders(); refreshIf(['home']); }),
    state.backend.subscribe('reminder_done', async () => { await loadReminders(); refreshIf(['home']); }),
    state.backend.subscribe('chores', async () => { await loadChores(); refreshIf(['home', 'chores']); }),
    state.backend.subscribe('chore_log', async () => { await loadChores(); refreshIf(['home', 'chores']); }),
    state.backend.subscribe('photos', async () => { await loadPhotos(); refreshIf(['home', 'photos']); }),
    state.backend.subscribe('photo_reactions', async () => { await loadPhotos(); refreshIf(['home', 'photos']); }),
    state.backend.subscribe('kudos', async () => { await loadKudos(); refreshIf(['home', 'kudos']); }),
    state.backend.subscribe('wishes', async () => { await loadWishes(); refreshIf(['wishes']); }),
    state.backend.subscribe('stories', async () => { await loadStories(); refreshIf(['home']); }),
    state.backend.subscribe('story_reactions', async () => { await loadStories(); }),
  ];
}

// Forsíðan uppfærist á mínútu fresti svo liðnir viðburðir detti út
setInterval(() => {
  if (state.me && state.tab === 'home' && document.visibilityState === 'visible') renderView();
}, 60000);

// Síminn vaknar (app opnað aftur af heimaskjá) → sækja nýjustu gögn
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !state.me) return;
  await Promise.all([loadItems(), loadMeals(), reloadProfiles(), loadNotices(), loadReminders(), loadChores(), loadPhotos(), loadKudos(), loadWishes(), loadStories()]);
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
  if (e.people.includes('allir')) return `<span class="who-all" title="Allir">${icon('users')}</span>`;
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
  const switcher = familyCount() > 1
    ? '<button class="link-btn" type="button" id="other-family">Önnur fjölskylda? Slá inn kóða</button>' : '';
  app.innerHTML = `
    <section class="center-screen">
      <div class="brand-mark">${icon('house')}</div>
      <h1>${esc(state.family?.name || 'Fjölskylduvikan')}</h1>
      <p class="muted">Skráðu fjölskylduaðganginn inn. Þetta þarf bara að gera einu sinni í hverjum síma.</p>
      <form class="stack" id="login">
        <label class="field"><span>Netfang</span>
          <input type="email" name="email" autocomplete="username" required inputmode="email"></label>
        <label class="field"><span>Lykilorð</span>
          <input type="password" name="password" autocomplete="current-password" required></label>
        ${message ? `<p class="error">${esc(message)}</p>` : ''}
        <button class="btn primary big" type="submit">Skrá inn</button>
      </form>
      ${switcher}
    </section>`;
  app.querySelector('#other-family')?.addEventListener('click', () => { forgetFamily(); renderFamilyCode(); });
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

// Fyrsta skipti í nýjum síma þegar fleiri en ein fjölskylda nota appið
function renderFamilyCode(message = '') {
  app.innerHTML = `
    <section class="center-screen">
      <div class="brand-mark">${icon('house')}</div>
      <h1>Fjölskylduvikan</h1>
      <p class="muted">Sláðu inn fjölskyldukóðann sem þú fékkst. Þetta þarf bara að gera einu sinni.</p>
      <form class="stack" id="family-code">
        <label class="field"><span>Fjölskyldukóði</span>
          <input name="code" required autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off"></label>
        ${message ? `<p class="error">${esc(message)}</p>` : ''}
        <button class="btn primary big" type="submit">Áfram</button>
      </form>
    </section>`;
  app.querySelector('#family-code').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('code');
    if (!chooseFamily(code)) return renderFamilyCode('Þessi kóði finnst ekki. Athugaðu stafsetninguna.');
    location.replace(location.pathname);   // byrja upp á nýtt með réttu fjölskylduna
  });
}

function renderError(msg) {
  app.innerHTML = `
    <section class="center-screen">
      <div class="brand-mark">${icon('wifi-off')}</div>
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

const famAv = (size = 'sm') => `<span class="avatar ${size} fam" style="--c:var(--accent)">${icon('users')}</span>`;

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
        <button class="link back" id="pin-back">${icon('chevron-left')} Til baka</button>
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
const ICONS = { home: icon('house'), cal: icon('calendar'), chores: icon('trophy'), food: icon('utensils'), saman: icon('heart') };

const TABS = [
  { id: 'home', label: 'Heim' },
  { id: 'cal', label: 'Dagatal' },
  { id: 'chores', label: 'Verk' },
  { id: 'food', label: 'Matur', subs: [['shop', 'Innkaup', 'shopping-cart'], ['menu', 'Matseðill', 'utensils']] },
  { id: 'saman', label: 'Saman', subs: [['photos', 'Myndir', 'camera'], ['kudos', 'Hrós', 'heart'], ['wishes', 'Óskalistar', 'gift']] },
];
const groupOf = (tab) => (TABS.find((t) => t.id === tab || t.subs?.some(([id]) => id === tab)) || TABS[0]).id;
const lastSub = {};

// Rofi efst í flipum sem hafa fleiri en eina síðu (Matur, Saman)
function subNav(tab) {
  const g = TABS.find((t) => t.id === groupOf(tab));
  if (!g?.subs) return '';
  return `<div class="segmented subnav">${g.subs.map(([id, label, ic]) =>
    `<button data-sub="${id}" class="${id === tab ? 'on' : ''}">${icon(ic)}${label}</button>`).join('')}</div>`;
}
function bindSubNav(view) {
  view.querySelectorAll('[data-sub]:not([data-bound])').forEach((b) => {
    b.dataset.bound = '1';
    b.addEventListener('click', () => go(b.dataset.sub));
  });
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <div class="title">Fjölskylduvikan</div>
      <div class="top-actions">
        ${isParent() ? `<button class="send-btn ${state.tab === 'home' ? '' : 'hidden'}" id="send-btn" aria-label="Senda tilkynningu">${icon('plus')}</button>` : ''}
        <button class="me-btn" id="me-btn" aria-label="Notandi: ${esc(state.me.name)}">${avatar(state.me)}</button>
      </div>
    </header>
    ${state.backend.mode === 'demo' ? '<div class="demo-banner">Prufuútgáfa — gögnin vistast bara í þessu tæki</div>' : ''}
    <main id="view"></main>
    <nav class="tabbar">
      ${TABS.map((t) => `
        <button data-tab="${t.id}" class="${groupOf(state.tab) === t.id ? 'active' : ''}">
          ${ICONS[t.id]}<span>${t.label}</span><i class="badge" data-badge="${t.id}"></i>
        </button>`).join('')}
    </nav>`;
  app.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    const g = TABS.find((t) => t.id === b.dataset.tab);
    go(g.subs ? (lastSub[g.id] || g.subs[0][0]) : g.id);
  }));
  app.querySelector('#me-btn').addEventListener('click', openMeSheet);
  app.querySelector('#send-btn')?.addEventListener('click', openSendSheet);
}

function go(tab) {
  state.tab = tab;
  const g = groupOf(tab);
  if (TABS.find((t) => t.id === g)?.subs) lastSub[g] = tab;
  app.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === g));
  app.querySelector('#send-btn')?.classList.toggle('hidden', tab !== 'home');
  renderView();
  window.scrollTo({ top: 0 });
}

function renderView() {
  const view = document.getElementById('view');
  if (!view) return;
  ({
    home: renderHome, cal: renderCal, chores: renderChores, shop: renderShop, menu: renderMenu,
    photos: renderPhotos, kudos: renderKudos, wishes: renderWishes,
  }[state.tab])(view);
  bindSubNav(view);
  const open = state.items.filter((i) => !i.checked).length;
  const badge = app.querySelector('[data-badge="food"]');
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
      <h1>${greet}, ${esc(firstName(state.me.name))}</h1>
    </section>

    ${storiesBar()}

    ${noticesCard()}
    ${pushPromptCard()}
    ${todayCard()}

    <button class="card tap tonight" data-go="menu">
      <div class="card-label">${icon('utensils')} Í kvöldmatinn</div>
      ${tonight
        ? `<div class="big-title">${esc(tonight.title)}</div>${tonight.notes ? `<p class="muted">${esc(tonight.notes)}</p>` : ''}`
        : `<div class="big-title muted">Ekkert ákveðið ennþá</div>
           <p class="muted">${isParent() ? 'Ýttu hér til að skipuleggja vikuna' : 'Mamma og pabbi eru að hugsa málið'}</p>`}
    </button>

    ${remindersCard()}
    ${isParent() ? approvalsCard() : myChoresCard()}
    ${photosHomeCard()}
    ${kudosHomeCard()}

    <button class="card tap" data-go="shop">
      <div class="card-head">
        <div class="card-label">${icon('shopping-cart')} Innkaupalisti</div>
        <span class="pill">${open.length ? `${open.length} eftir` : 'Allt komið'}</span>
      </div>
      ${open.length
        ? `<div class="chips">${open.slice(0, 6).map((i) => `<span class="chip">${esc(i.name)}</span>`).join('')}${open.length > 6 ? `<span class="chip more">+${open.length - 6}</span>` : ''}</div>`
        : '<p class="muted">Listinn er tómur. Vel gert!</p>'}
    </button>

    ${jokeCard()}
    `;

  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  bindEvents(view);
  view.querySelector('#push-yes')?.addEventListener('click', enablePush);
  bindChoreButtons(view);
  bindSaman(view);
  bindStories(view);
  view.querySelector('#joke-reveal')?.addEventListener('click', (e) => {
    e.currentTarget.closest('.joke-card').classList.add('revealed');
  });
  view.querySelector('#rem-add')?.addEventListener('click', () => openReminderSheet());
  view.querySelector('#rem-all')?.addEventListener('click', openAllReminders);
  view.querySelectorAll('[data-rem-done]').forEach((b) => b.addEventListener('click', () => toggleRemDone(b.dataset.remDone)));
  view.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', () => {
    dismissNotice(b.dataset.dismiss);
    renderView();
  }));
  view.querySelector('#push-later')?.addEventListener('click', () => { store.set('fv.pushlater', String(Date.now())); renderView(); });
}

// Brandari dagsins — neðst á forsíðunni, sami fyrir alla í dag
function jokeCard() {
  const j = jokeOfTheDay();
  return `
    <section class="card joke-card">
      <div class="card-label">${icon('laugh')} Brandari dagsins</div>
      <p class="joke-q">${esc(j.q)}</p>
      ${j.a ? `<button class="btn small-btn" id="joke-reveal">Sjá svarið</button>
        <p class="joke-a">${esc(j.a)}</p>` : ''}
    </section>`;
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
    ? '<p class="muted">Allt búið í dag</p>'
    : '<p class="muted">Ekkert á dagskrá í dag</p>';
  else body = `<ul class="events compact">${today.slice(0, 6).map(eventRow).join('')}</ul>
    ${today.length > 6 ? `<p class="muted small">+${today.length - 6} í viðbót</p>` : ''}`;
  return `
    <section class="card">
      <div class="card-head">
        <div class="card-label">${icon('calendar')} Í dag</div>
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
      ${subNav('shop')}
      <form id="add-form" class="add-form" autocomplete="off">
        <input id="add-input" placeholder="Bæta á listann… (t.d. mjólk, egg)" aria-label="Vara" enterkeyhint="done">
        <button class="btn primary" type="submit" aria-label="Bæta við">${icon('plus')}</button>
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
          <span class="box">${i.checked ? icon('check') : ''}</span>
          <span class="name">${esc(i.name)}</span>
        </button>
        <span class="by" title="${esc(who?.name || '')}">${avatar(who, 'sm')}</span>
        <button class="del" data-del="${esc(i.id)}" aria-label="Eyða ${esc(i.name)}">${icon('x')}</button>
      </li>`;
  };

  el.innerHTML = `
    ${!open.length && !done.length ? `
      <div class="empty"><div class="empty-mark">${icon('shopping-basket')}</div><p>Listinn er tómur.</p>
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
    ${subNav('menu')}
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
                : `<div class="meal-title muted">${isParent() ? icon('plus') + ' Bæta við máltíð' : 'Ekkert ákveðið'}</div>`}
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
      <button class="icon-btn" id="prev-week" aria-label="Fyrri vika">${icon('chevron-left')}</button>
      <div class="week-label">
        <strong>${thisWeek ? 'Þessi vika' : `Vika ${isoWeek(monday)}`}</strong>
        <span class="muted">${esc(weekRange(monday))}</span>
      </div>
      <button class="icon-btn" id="next-week" aria-label="Næsta vika">${icon('chevron-right')}</button>
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
      ? 'Fallið fannst, en leynilegu iCal-slóðina (t.d. ICAL_FJOLSKYLDA) vantar í Supabase → Edge Functions → Secrets.'
      : `Fann ekki dagatalsfallið „${esc(state.family?.fn || 'clever-api')}“ í Supabase → Edge Functions.`;
    body = `<div class="empty"><div class="empty-mark">${icon('plug')}</div><p>Dagatalið er ekki tengt ennþá</p>
      <p class="muted">${why}</p><button class="btn" id="cal-retry">Reyna aftur</button>
      <p class="muted small">Útgáfa ${APP_VERSION}</p></div>`;
  } else if (state.calStatus === 'loading') {
    body = `<div class="empty"><div class="empty-mark">${icon('calendar')}</div><p class="muted">Sæki dagatalið…</p></div>`;
  } else if (state.calStatus === 'error' && !state.events.length) {
    body = `<div class="empty"><div class="empty-mark">${icon('wifi-off')}</div><p>Náði ekki í dagatalið</p>
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
    ${state.calFailed.length ? `<p class="muted small">${icon('wifi-off')} Náði ekki í öll dagatölin núna — reyni aftur seinna.</p>` : ''}
    <p class="coming">Viðburðum er bætt við í Google Calendar. Settu nafnið fremst í titilinn,<br>t.d. „${esc(firstName(kids()[0]?.name || state.me?.name || 'Anna'))} – fimleikar“, þá fer hann á rétta manneskju.</p>`;
  }

  view.innerHTML = `
    <section class="hero compact"><h1>Dagatal</h1></section>
    <div class="filters" role="tablist" aria-label="Sýna dagatal fyrir">
      ${chip('allir', 'Allir', 'var(--accent)', famAv())}
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
    ? `<span class="who-row">${famAv()} Öll fjölskyldan</span>`
    : e.people.map((id) => { const p = profileById(id); return p ? `<span class="who-row">${avatar(p, 'sm')} ${esc(p.name)}</span>` : ''; }).join('');
  openSheet(`
    <h2>${esc(e.title)}</h2>
    <p class="muted">${esc(when)}</p>
    ${e.location ? `<p>${icon('map-pin')} ${esc(e.location)}</p>` : ''}
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
        ${m.ingredients?.length ? `<button class="btn primary" id="to-list">${icon('shopping-cart')} Setja hráefni á listann</button>` : ''}
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
  if (!rows.length) return toast('Allt er nú þegar á listanum');
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
      <label class="menu-file">${icon('camera')} ${state.me.photo ? 'Skipta um mynd' : 'Setja inn mynd af mér'}
        <input type="file" accept="image/*" id="photo-input" hidden></label>
      ${state.me.photo ? `<button id="remove-photo">${icon('undo-2')} Nota emoji í staðinn</button>` : ''}
      <button id="switch-user">${icon('refresh-cw')} Skipta um notanda</button>
      ${pushMenuRow()}
      <button id="change-pin">${icon('key-round')} Breyta PIN-inu mínu</button>
      ${isParent() && others.length ? `
        <div class="card-label">Gleymt PIN? Endurstilla fyrir:</div>
        ${others.map((p) => `<button data-reset="${esc(p.id)}">${avatar(p, 'sm')} ${esc(p.name)}</button>`).join('')}` : ''}
      ${state.backend.mode === 'live' ? `<button id="sign-out" class="danger-text">${icon('log-out')} Skrá fjölskylduaðgang út úr þessum síma</button>` : ''}
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

// ==================================================================
// Saman: mynd dagsins, hrós, óskalistar
// ==================================================================
async function loadPhotos() {
  try {
    const from = iso(addDays(new Date(), -state.photoDays));
    const photos = await state.backend.listPhotos(from);
    const [reactions, urls] = await Promise.all([
      state.backend.listReactions(photos.map((p) => p.id)),
      state.backend.photoUrls(photos.map((p) => p.path).filter((p) => !state.photoUrls[p])),
    ]);
    state.photos = photos;
    state.reactions = reactions || [];
    Object.assign(state.photoUrls, urls);
  } catch (e) { console.error(e); state.photos = []; }
}
async function loadKudos() {
  try { state.kudos = await state.backend.listKudos(new Date(Date.now() - 30 * 86400000).toISOString()); }
  catch { state.kudos = []; }
}
async function loadWishes() {
  try { state.wishes = await state.backend.listWishes(); } catch { state.wishes = []; }
}

const photoSrc = (p) => state.photoUrls[p.path] || '';
const myPhotoToday = () => state.photos.find((p) => p.profile_id === state.me.id && p.day === todayIso());

function bindSaman(root) {
  root.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhotoViewer(b.dataset.photo)));
  root.querySelector('#photo-add')?.addEventListener('click', openPhotoPicker);
  root.querySelector('#kudos-add')?.addEventListener('click', () => openKudosSheet());
}

// ---------------- 📸 Mynd dagsins ----------------
function photosHomeCard() {
  const today = state.photos.filter((p) => p.day === todayIso());
  const mine = myPhotoToday();
  return `
    <section class="card photos-card">
      <div class="card-head">
        <div class="card-label">${icon('camera')} Myndir dagsins</div>
        <button class="link small" data-go="photos">Árið okkar ›</button>
      </div>
      ${today.length ? `<div class="photo-strip">${today.map((p) => `
        <button class="thumb" data-photo="${esc(p.id)}" aria-label="Mynd frá ${esc(profileById(p.profile_id)?.name || '')}">
          <img src="${esc(photoSrc(p))}" alt="" loading="lazy">${avatar(profileById(p.profile_id), 'sm')}
        </button>`).join('')}</div>` : '<p class="muted">Engin mynd komin í dag.</p>'}
      ${mine ? '' : `<button class="btn add-rem" id="photo-add">${icon('camera')} Taka mynd dagsins</button>`}
    </section>`;
}

// Les dagsetninguna sem myndavélin skráði í myndina (EXIF). null ef ekki finnst.
async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 262144).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const len = v.getUint16(off + 2);
      if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) {            // "Exif"
        const t = off + 10;
        const le = v.getUint16(t) === 0x4949;
        const u16 = (o) => v.getUint16(t + o, le);
        const u32 = (o) => v.getUint32(t + o, le);
        const str = (o, n) => { let x = ''; for (let i = 0; i < n - 1; i++) x += String.fromCharCode(v.getUint8(t + o + i)); return x; };
        const readIfd = (ifd) => {
          const out = {};
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            const tag = u16(e), count = u32(e + 4);
            if (tag === 0x8769) out.exif = u32(e + 8);
            if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004) out[tag] = str(u32(e + 8), count);
          }
          return out;
        };
        const ifd0 = readIfd(u32(4));
        const exif = ifd0.exif ? readIfd(ifd0.exif) : {};
        const raw = exif[0x9003] || exif[0x9004] || ifd0[0x0132];
        const m = raw && raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
        return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
      }
      if ((marker & 0xFF00) !== 0xFF00) return null;
      off += 2 + len;
    }
  } catch { /* ekki lesanlegt */ }
  return null;
}

async function shrinkPhoto(file, max = 1440) {
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    img = await new Promise((res, rej) => {
      const u = URL.createObjectURL(file); const i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u;
    });
  }
  const w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}

function openPhotoPicker() {
  const s = openSheet(`
    <h2>Mynd dagsins</h2>
    <p class="muted">${myPhotoToday() ? 'Þú ert búin/n að setja mynd í dag — ný mynd kemur í staðinn.' : 'Ein mynd á mann á dag. Myndin þarf að vera tekin í dag.'}</p>
    <label class="btn primary big file-btn">${icon('camera')} Taka mynd<input type="file" accept="image/*" capture="environment" id="pick-camera" hidden></label>
    <label class="btn big file-btn">${icon('image')} Velja mynd frá í dag<input type="file" accept="image/jpeg,image/*" id="pick-library" hidden></label>
    <button class="btn" data-close>Hætta við</button>`);
  const handle = async (file, fromCamera) => {
    if (!file) return;
    let taken = await readExifDate(file);
    if (!fromCamera) {
      if (!taken) return toast('Gat ekki séð hvenær myndin var tekin — notaðu „Taka mynd“');
      if (iso(taken) !== todayIso()) return toast('Myndin þarf að vera tekin í dag');
    } else if (taken && iso(taken) !== todayIso()) {
      return toast('Myndin þarf að vera tekin í dag');
    }
    s.close();
    setTimeout(() => openPhotoCaption(file, taken || new Date()), 230);
  };
  s.el.querySelector('#pick-camera').addEventListener('change', (e) => handle(e.target.files?.[0], true));
  s.el.querySelector('#pick-library').addEventListener('change', (e) => handle(e.target.files?.[0], false));
}

function openPhotoCaption(file, taken) {
  const preview = URL.createObjectURL(file);
  const s = openSheet(`
    <h2>Mynd dagsins</h2>
    <img class="photo-preview" src="${preview}" alt="">
    <label class="field"><span>Texti <em class="muted">(valfrjálst)</em></span>
      <input id="photo-caption" maxlength="140" placeholder="t.d. Fyrsti snjórinn ❄️"></label>
    <div class="sheet-actions">
      <button class="btn primary big" id="photo-save">Setja inn</button>
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const btn = s.el.querySelector('#photo-save');
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Sendi mynd…';
    try {
      const blob = await shrinkPhoto(file);
      await state.backend.addPhoto({
        profile_id: state.me.id, day: todayIso(), taken_at: taken.toISOString(),
        caption: s.el.querySelector('#photo-caption').value.trim() || null, blob,
      });
      URL.revokeObjectURL(preview);
      s.close();
      await loadPhotos(); renderView();
      toast('Mynd dagsins komin 📸');
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = 'Setja inn';
      toast('Gat ekki sent myndina — er búið að keyra 6-saman.sql?');
    }
  });
}

const REACTIONS = ['❤️', '😂', '😍', '👏', '🔥'];

function openPhotoViewer(id) {
  const p = state.photos.find((x) => x.id === id);
  if (!p) return;
  const who = profileById(p.profile_id);
  const mine = state.reactions.find((r) => r.photo_id === id && r.profile_id === state.me.id)?.emoji;
  const counts = Object.fromEntries(REACTIONS.map((e) => [e, state.reactions.filter((r) => r.photo_id === id && r.emoji === e).length]));
  const whoReacted = state.reactions.filter((r) => r.photo_id === id)
    .map((r) => `${r.emoji} ${esc(firstName(profileById(r.profile_id)?.name || ''))}`).join(' · ');
  const s = openSheet(`
    <img class="photo-full" src="${esc(photoSrc(p))}" alt="">
    <div class="photo-meta">${avatar(who, 'sm')}<div>
      <strong>${esc(who?.name || '')}</strong>
      <span class="muted small">${esc(longDate(fromIso(p.day)))}</span></div></div>
    ${p.caption ? `<p class="photo-caption">${esc(p.caption)}</p>` : ''}
    <div class="react-row">${REACTIONS.map((e) => `
      <button class="react ${mine === e ? 'on' : ''}" data-react="${e}">${e}${counts[e] ? `<span>${counts[e]}</span>` : ''}</button>`).join('')}</div>
    ${whoReacted ? `<p class="muted small">${whoReacted}</p>` : ''}
    <div class="sheet-actions">
      ${p.profile_id === state.me.id || isParent() ? '<button class="btn danger-text" id="photo-del">Eyða mynd</button>' : ''}
      <button class="btn" data-close>Loka</button>
    </div>`);
  s.el.querySelectorAll('[data-react]').forEach((b) => b.addEventListener('click', async () => {
    const e = b.dataset.react === mine ? null : b.dataset.react;
    try {
      await state.backend.react(id, state.me.id, e);
      await loadPhotos(); s.close(); renderView();
      setTimeout(() => openPhotoViewer(id), 230);
    } catch { toast('Gat ekki vistað'); }
  }));
  s.el.querySelector('#photo-del')?.addEventListener('click', async () => {
    try { await state.backend.deletePhoto(p); await loadPhotos(); s.close(); renderView(); toast('Mynd eytt'); }
    catch { toast('Gat ekki eytt'); }
  });
}

function renderPhotos(view) {
  const byDay = new Map();
  for (const p of state.photos) (byDay.get(p.day) || byDay.set(p.day, []).get(p.day)).push(p);
  let lastMonth = '';
  const days = [...byDay.entries()].map(([day, list]) => {
    const d = fromIso(day);
    const month = `${MONTHS[d.getMonth()].charAt(0).toUpperCase() + MONTHS[d.getMonth()].slice(1)} ${d.getFullYear()}`;
    const head = month !== lastMonth ? `<h2 class="month-title">${esc(month)}</h2>` : '';
    lastMonth = month;
    return `${head}
      <section class="photo-day">
        <div class="photo-day-title">${esc(DAYS[d.getDay()])} ${d.getDate()}.${day === todayIso() ? '<span class="pill accent">Í dag</span>' : ''}</div>
        <div class="photo-grid">${list.map((p) => {
          const n = state.reactions.filter((r) => r.photo_id === p.id).length;
          return `<button class="thumb big" data-photo="${esc(p.id)}">
            <img src="${esc(photoSrc(p))}" alt="" loading="lazy">${avatar(profileById(p.profile_id), 'sm')}
            ${n ? `<span class="react-count">${icon('heart')} ${n}</span>` : ''}</button>`;
        }).join('')}</div>
      </section>`;
  }).join('');

  view.innerHTML = `
    ${subNav('photos')}
    <section class="hero compact"><h1>Árið okkar</h1></section>
    ${myPhotoToday() ? '' : `<button class="btn primary big" id="photo-add">${icon('camera')} Taka mynd dagsins</button>`}
    ${days || `<div class="empty"><div class="empty-mark">${icon('camera')}</div><p>Engar myndir ennþá</p><p class="muted">Ein mynd á dag frá hverjum — og í lok árs eigið þið heilt myndaalbúm.</p></div>`}
    ${state.photos.length ? '<button class="btn" id="photos-more">Sjá eldri myndir</button>' : ''}`;
  bindSaman(view);
  view.querySelector('#photos-more')?.addEventListener('click', async () => {
    state.photoDays += 120; await loadPhotos(); renderView();
  });
}

// ---------------- 💛 Hrós ----------------
const KUDOS_EMOJI = ['💛', '💪', '🌟', '🙏', '🔥', '😂'];
const KUDOS_QUICK = ['Takk fyrir hjálpina!', 'Vel gert í dag!', 'Þú ert frábær 💛', 'Takk fyrir að taka til', 'Geggjað á æfingunni!'];

function kudosRow(k) {
  const from = profileById(k.from_id), to = k.to_id ? profileById(k.to_id) : null;
  return `<li class="kudos">
    <div class="kudos-who">${avatar(from, 'sm')}<span class="arrow">→</span>${to ? avatar(to, 'sm') : famAv()}
      <span class="muted small">${esc(firstName(from?.name || ''))} → ${esc(to ? firstName(to.name) : 'öll fjölskyldan')} · ${esc(relTime(k.created_at))}</span></div>
    <p class="kudos-body"><span class="kudos-emoji">${esc(k.emoji)}</span> ${esc(k.body)}</p>
  </li>`;
}

function kudosHomeCard() {
  const today = state.kudos.filter((k) => iso(new Date(k.created_at)) === todayIso());
  return `
    <section class="card kudos-card">
      <div class="card-head">
        <div class="card-label">${icon('heart')} Hrós dagsins</div>
        <button class="link small" data-go="kudos">Hrósveggurinn ›</button>
      </div>
      ${today.length ? `<ul class="kudos-list">${today.slice(0, 2).map(kudosRow).join('')}</ul>
        ${today.length > 2 ? `<p class="muted small">+${today.length - 2} fleiri í dag</p>` : ''}`
        : '<p class="muted">Enginn hefur fengið hrós í dag ennþá. Vertu fyrst/ur!</p>'}
      <button class="btn add-rem" id="kudos-add">${icon('heart')} Senda hrós</button>
    </section>`;
}

function renderKudos(view) {
  view.innerHTML = `
    ${subNav('kudos')}
    <section class="hero compact"><h1>Hrósveggurinn</h1></section>
    <button class="btn primary big" id="kudos-add">${icon('heart')} Senda hrós</button>
    ${state.kudos.length ? `<ul class="kudos-list wall">${state.kudos.map(kudosRow).join('')}</ul>`
      : `<div class="empty"><div class="empty-mark">${icon('heart')}</div><p>Engin hrós ennþá</p><p class="muted">Sendu fyrsta hrósið!</p></div>`}`;
  bindSaman(view);
}

function openKudosSheet() {
  let to = null, emoji = '💛';
  const others = state.profiles.filter((p) => p.id !== state.me.id);
  const s = openSheet(`
    <h2>Senda hrós</h2>
    <div class="card-label">Til</div>
    <div class="filters wrap">
      ${others.map((p) => `<button class="filter" data-kto="${esc(p.id)}" style="--c:${esc(p.color)}">${avatar(p, 'sm')}<span>${esc(firstName(p.name))}</span></button>`).join('')}
      <button class="filter" data-kto="allir" style="--c:var(--accent)">${famAv()}<span>Allir</span></button>
    </div>
    <div class="emoji-pick">${KUDOS_EMOJI.map((e) => `<button class="${e === emoji ? 'on' : ''}" data-kemoji="${e}">${e}</button>`).join('')}</div>
    <label class="field"><span>Hrósið</span><textarea id="kudos-text" rows="2" maxlength="200" placeholder="Hvað viltu þakka eða hrósa fyrir?"></textarea></label>
    <div class="chips">${KUDOS_QUICK.map((q) => `<button class="chip quick" type="button">${esc(q)}</button>`).join('')}</div>
    <div class="sheet-actions">
      <button class="btn primary big" id="kudos-send">Senda hrós</button>
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  el.querySelectorAll('[data-kto]').forEach((b) => b.addEventListener('click', () => {
    to = b.dataset.kto;
    el.querySelectorAll('[data-kto]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  el.querySelectorAll('[data-kemoji]').forEach((b) => b.addEventListener('click', () => {
    emoji = b.dataset.kemoji;
    el.querySelectorAll('[data-kemoji]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const text = el.querySelector('#kudos-text');
  el.querySelectorAll('.quick').forEach((b) => b.addEventListener('click', () => { text.value = b.textContent; }));
  el.querySelector('#kudos-send').addEventListener('click', async () => {
    if (!to) return toast('Veldu hverjum hrósið er til');
    const body = text.value.trim();
    if (!body) { text.focus(); return toast('Skrifaðu hrósið'); }
    try {
      const id = await state.backend.addKudos({ from_id: state.me.id, to_id: to === 'allir' ? null : to, emoji, body });
      state.backend.kudosPush(id).catch(() => {});
      s.close(); await loadKudos(); renderView();
      toast('Hrós sent 💛');
    } catch (e) { console.error(e); toast('Gat ekki sent — er búið að keyra 6-saman.sql?'); }
  });
}

// ---------------- 🎁 Óskalistar ----------------
const kr = (n) => (n || n === 0) ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kr.' : '';
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

function renderWishes(view) {
  const who = profileById(state.wishPerson) || state.me;
  state.wishPerson = who.id;
  const mineList = who.id === state.me.id;
  const list = state.wishes.filter((w) => w.owner_id === who.id)
    .sort((a, b) => (b.starred - a.starred) || a.created_at.localeCompare(b.created_at));
  const people = [state.me, ...state.profiles.filter((p) => p.id !== state.me.id)];
  view.innerHTML = `
    ${subNav('wishes')}
    <div class="filters">${people.map((p) => `
      <button class="filter ${p.id === who.id ? 'on' : ''}" data-wperson="${esc(p.id)}" style="--c:${esc(p.color)}">${avatar(p, 'sm')}<span>${esc(p.id === state.me.id ? 'Minn listi' : firstName(p.name))}</span></button>`).join('')}</div>
    <section class="hero compact"><h1>${mineList ? 'Óskalistinn minn' : `Óskalisti — ${esc(firstName(who.name))}`}</h1>
      ${mineList ? '<p class="muted small">Hinir geta tekið frá gjafir — þú sérð aldrei hvað er frátekið 🤫</p>' : '<p class="muted small">Taktu frá það sem þú ætlar að gefa. ' + esc(firstName(who.name)) + ' sér það ekki 🤫</p>'}</section>
    ${mineList ? `<button class="btn primary big" id="wish-add">${icon('plus')} Ný ósk</button>` : ''}
    ${list.length ? `<ul class="wish-list">${list.map((w) => {
      const link = safeUrl(w.url);
      const claimer = w.claimed_by ? profileById(w.claimed_by) : null;
      let action = '';
      if (mineList) action = `<button class="btn small-btn" data-got="${esc(w.id)}">${icon('check')} Fékk þetta</button>`;
      else if (!w.claimed_by) action = `<button class="btn small-btn primary" data-claim="${esc(w.id)}">${icon('gift')} Ég kaupi þessa</button>`;
      else if (w.claimed_by === state.me.id) action = `<button class="btn small-btn" data-unclaim="${esc(w.id)}">${icon('check')} Þú tókst þessa · Hætta við</button>`;
      else action = `<span class="claimed">${icon('gift')} ${esc(firstName(claimer?.name || ''))} tók frá</span>`;
      return `<li class="wish ${!mineList && w.claimed_by ? 'is-claimed' : ''}">
        <button class="wish-main" ${mineList ? `data-wedit="${esc(w.id)}"` : 'disabled'}>
          <span class="wish-title">${w.starred ? icon('star', 'star-on') + ' ' : ''}${esc(w.title)}</span>
          ${w.price ? `<span class="wish-price">${esc(kr(w.price))}</span>` : ''}
          ${w.note ? `<span class="muted small">${esc(w.note)}</span>` : ''}
        </button>
        <div class="wish-actions">${link ? `<a class="link small" href="${esc(link)}" target="_blank" rel="noopener">Skoða ${icon('external-link')}</a>` : '<span></span>'}${action}</div>
      </li>`;
    }).join('')}</ul>`
      : `<div class="empty"><div class="empty-mark">${icon('gift')}</div><p>${mineList ? 'Listinn þinn er tómur' : `${esc(firstName(who.name))} hefur ekki sett neitt á listann`}</p>
        ${mineList ? '<p class="muted">Bættu við því sem þig langar í — fyrir jól eða afmæli.</p>' : ''}</div>`}`;

  view.querySelectorAll('[data-wperson]').forEach((b) => b.addEventListener('click', () => { state.wishPerson = b.dataset.wperson; renderView(); }));
  view.querySelector('#wish-add')?.addEventListener('click', () => openWishEditor());
  view.querySelectorAll('[data-wedit]').forEach((b) => b.addEventListener('click', () => openWishEditor(state.wishes.find((w) => w.id === b.dataset.wedit))));
  const upd = async (id, patch, msg) => {
    try { await state.backend.saveWish({ id, ...patch }); await loadWishes(); renderView(); if (msg) toast(msg); }
    catch { toast('Gat ekki vistað'); }
  };
  view.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.claim, { claimed_by: state.me.id, claimed_at: new Date().toISOString() }, 'Frátekið')));
  view.querySelectorAll('[data-unclaim]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.unclaim, { claimed_by: null, claimed_at: null })));
  view.querySelectorAll('[data-got]').forEach((b) => b.addEventListener('click', async () => {
    try { await state.backend.deleteWish(b.dataset.got); await loadWishes(); renderView(); toast('Til hamingju með gjöfina 🎉'); }
    catch { toast('Gat ekki vistað'); }
  }));
}

function openWishEditor(w = null) {
  const s = openSheet(`
    <h2>${w ? 'Breyta ósk' : 'Ný ósk'}</h2>
    <label class="field"><span>Hvað langar þig í?</span><input id="w-title" maxlength="80" value="${esc(w?.title || '')}" placeholder="t.d. Airpods"></label>
    <label class="field"><span>Hlekkur <em class="muted">(valfrjálst)</em></span><input id="w-url" type="url" inputmode="url" value="${esc(w?.url || '')}" placeholder="https://…"></label>
    <label class="field"><span>Verð í kr. <em class="muted">(valfrjálst)</em></span><input id="w-price" inputmode="numeric" value="${esc(w?.price ?? '')}" placeholder="t.d. 9990"></label>
    <label class="field"><span>Athugasemd <em class="muted">(valfrjálst)</em></span><input id="w-note" maxlength="120" value="${esc(w?.note || '')}" placeholder="t.d. stærð M, svartur"></label>
    <label class="toggle-row"><input type="checkbox" id="w-star" ${w?.starred ? 'checked' : ''}><span>${icon('star')} Mig langar mest í þetta</span></label>
    <div class="sheet-actions">
      <button class="btn primary big" id="w-save">Vista</button>
      ${w ? '<button class="btn danger-text" id="w-del">Eyða ósk</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  el.querySelector('#w-save').addEventListener('click', async () => {
    const title = el.querySelector('#w-title').value.trim();
    if (!title) { el.querySelector('#w-title').focus(); return toast('Skrifaðu hvað þig langar í'); }
    const rawUrl = el.querySelector('#w-url').value.trim();
    const url = rawUrl ? safeUrl(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl) : null;
    if (rawUrl && !url) return toast('Hlekkurinn lítur ekki rétt út');
    const priceNum = parseInt(el.querySelector('#w-price').value.replace(/\D/g, ''), 10);
    const row = {
      ...(w ? { id: w.id } : { owner_id: state.me.id }),
      title, url, price: Number.isFinite(priceNum) ? priceNum : null,
      note: el.querySelector('#w-note').value.trim() || null,
      starred: el.querySelector('#w-star').checked,
    };
    try { await state.backend.saveWish(row); await loadWishes(); s.close(); renderView(); toast(w ? 'Ósk uppfærð' : 'Ósk komin á listann'); }
    catch (e) { console.error(e); toast('Gat ekki vistað — er búið að keyra 6-saman.sql?'); }
  });
  el.querySelector('#w-del')?.addEventListener('click', async () => {
    try { await state.backend.deleteWish(w.id); await loadWishes(); s.close(); renderView(); toast('Ósk eytt'); }
    catch { toast('Gat ekki eytt'); }
  });
  if (!w) setTimeout(() => el.querySelector('#w-title').focus(), 250);
}

// ------------------------------------------------------------------
// Heimilisverk og stigatafla
// ------------------------------------------------------------------
const kids = () => state.profiles.filter((p) => p.role === 'child');
const mondayIso = (d = new Date()) => iso(startOfWeek(d));
const weekDays = (monIso) => [0, 1, 2, 3, 4, 5, 6].map((n) => iso(addDays(fromIso(monIso), n)));

async function loadChores() {
  const lastMon = iso(addDays(startOfWeek(new Date()), -7));
  const sun = iso(addDays(startOfWeek(new Date()), 6));
  try {
    const [chores, logs] = await Promise.all([state.backend.listChores(), state.backend.listChoreLogs(lastMon, sun)]);
    state.chores = chores || [];
    state.choreLogs = logs || [];
  } catch (e) { state.chores = []; state.choreLogs = []; }   // töflurnar ekki til ennþá
}

const choreOn = (c, dayIso) => (c.repeat_days || []).includes(fromIso(dayIso).getDay());
const choreFor = (c, kidId) => !(c.to_ids || []).length || c.to_ids.includes(kidId);
const choresToday = (kidId, day = todayIso()) => state.chores.filter((c) => choreOn(c, day) && choreFor(c, kidId));
const logOf = (c, kidId, day = todayIso()) => state.choreLogs.find((l) => l.chore_id === c.id && l.day === day && l.profile_id === kidId);
const takenBy = (c, day = todayIso()) => (c.mode === 'anyone' ? state.choreLogs.find((l) => l.chore_id === c.id && l.day === day) : null);

function weekTotals(monIso) {
  const days = new Set(weekDays(monIso));
  const t = Object.fromEntries(kids().map((k) => [k.id, { points: 0, pending: 0, count: 0 }]));
  for (const l of state.choreLogs) {
    if (!days.has(l.day) || !t[l.profile_id]) continue;
    if (l.status === 'approved') { t[l.profile_id].points += l.points; t[l.profile_id].count++; }
    else t[l.profile_id].pending += l.points;
  }
  return t;
}

function leaderboard(monIso = mondayIso()) {
  const t = weekTotals(monIso);
  return kids().map((k) => ({ kid: k, ...t[k.id] })).sort((a, b) => b.points - a.points || a.kid.sort - b.kid.sort);
}

// Bikarhafi = efstur síðustu viku (fleiri ef jafnt)
function trophyHolders() {
  const rows = leaderboard(iso(addDays(startOfWeek(new Date()), -7)));
  const best = rows[0]?.points || 0;
  return best > 0 ? { ids: rows.filter((r) => r.points === best).map((r) => r.kid.id), points: best } : { ids: [], points: 0 };
}

const withTrophy = (p, size) => `<span class="trophy-wrap">${avatar(p, size)}${trophyHolders().ids.includes(p.id) ? `<span class="trophy-badge" title="Bikarhafi">${icon('trophy')}</span>` : ''}</span>`;
// Jöfn stig = sama sæti
const rankIn = (rows, pts) => 1 + rows.filter((r) => r.points > pts).length;
const rankOf = (kidId) => { const rows = leaderboard(); return rankIn(rows, rows.find((r) => r.kid.id === kidId)?.points || 0); };

function choreRow(c, kidId, { compact = false } = {}) {
  const log = logOf(c, kidId);
  const other = !log && takenBy(c);
  const otherName = other ? firstName(profileById(other.profile_id)?.name || '') : '';
  let right;
  if (log?.status === 'approved') right = `<span class="pts got">+${log.points} ${icon('star', 'fill')}</span>`;
  else if (log) right = `<span class="pts wait">${icon('clock')} Bíður</span>`;
  else if (other) right = `<span class="muted small">${esc(otherName)} tók það</span>`;
  else right = `<span class="pts">${c.points} ${icon('star', 'fill')}</span>`;
  const canUndo = log && !log.approved_by;
  const clickable = (!log && !other) || canUndo;
  return `
    <li class="chore ${log ? (log.status === 'approved' ? 'done' : 'pending') : ''} ${other ? 'taken' : ''}">
      <button class="chore-btn" ${clickable ? `data-chore="${esc(c.id)}"` : 'disabled'}
        aria-label="${esc(c.title)}${log ? ' — búið' : ''}">
        <span class="chore-emoji">${esc(c.emoji)}</span>
        <span class="chore-title">${esc(c.title)}${!compact && c.mode === 'anyone' && !log && !other ? '<span class="muted small"> · fyrstur fær</span>' : ''}</span>
        ${right}
      </button>
    </li>`;
}

// Verk sem bíða seinna í vikunni (til sunnudags)
function laterThisWeek(kidId) {
  const sunday = iso(addDays(startOfWeek(new Date()), 6));
  const rows = [];
  for (let d = addDays(new Date(), 1); iso(d) <= sunday; d = addDays(d, 1)) {
    const day = iso(d);
    const list = state.chores.filter((c) => choreOn(c, day) && choreFor(c, kidId) && (c.repeat_days || []).length < 7);
    if (list.length) rows.push({ d, list });
  }
  if (!rows.length) return '';
  return `
    <section class="card">
      <div class="card-label">${icon('calendar-days')} Seinna í vikunni</div>
      <ul class="later-list">${rows.map(({ d, list }) => `
        <li><span class="later-day">${esc(DAYS_SHORT[d.getDay()])}</span>
          <span class="later-chores">${list.map((c) => `<span>${esc(c.emoji)} ${esc(c.title)} <span class="muted small">${c.points} ${icon('star', 'fill')}</span></span>`).join('')}</span></li>`).join('')}
      </ul>
      <p class="muted small">Verk sem eru alla daga eru ekki talin upp hér.</p>
    </section>`;
}

function myChoresCard() {
  if (state.me.role !== 'child' || !state.chores.length) return '';
  const list = choresToday(state.me.id);
  const todo = list.filter((c) => !logOf(c, state.me.id) && !takenBy(c));
  const pending = list.filter((c) => logOf(c, state.me.id)?.status === 'pending');
  const t = weekTotals(mondayIso())[state.me.id] || { points: 0 };
  return `
    <section class="card chores-card">
      <div class="card-head">
        <div class="card-label">${icon('list-checks')} Verkin mín í dag</div>
        <button class="link small" data-go="chores">Verk ›</button>
      </div>
      ${todo.length || pending.length
        ? `<ul class="chore-list">${[...todo, ...pending].map((c) => choreRow(c, state.me.id, { compact: true })).join('')}</ul>`
        : `<p class="muted">${list.length ? 'Öll verkin búin í dag!' : 'Engin verk í dag.'}</p>`}
      <div class="my-score">
        ${trophyHolders().ids.includes(state.me.id) ? `<span class="trophy-line">${icon('trophy')} Þú ert með bikarinn!</span>` : ''}
        <span><strong>${t.points}</strong> ${icon('star', 'fill')} í vikunni</span>
      </div>
    </section>`;
}

function approvalsCard() {
  const pending = state.choreLogs.filter((l) => l.status === 'pending' && l.day >= iso(addDays(new Date(), -7)));
  if (!pending.length) return '';
  return `
    <section class="card approvals">
      <div class="card-label">${icon('clock')} Bíður samþykkis (${pending.length})</div>
      <ul class="approve-list">${pending.map((l) => {
        const c = state.chores.find((x) => x.id === l.chore_id);
        const k = profileById(l.profile_id);
        return `<li>${avatar(k, 'sm')}
          <div class="approve-text"><strong>${esc(c ? c.emoji + ' ' + c.title : 'Verk')}</strong>
            <span class="muted small">${esc(firstName(k?.name || ''))} · ${l.points} stig${l.day !== todayIso() ? ' · ' + esc(DAYS_SHORT[fromIso(l.day).getDay()]) : ''}</span></div>
          <button class="round-btn no" data-review="${esc(l.id)}" data-ok="0" aria-label="Ekki samþykkja">${icon('x')}</button>
          <button class="round-btn yes" data-review="${esc(l.id)}" data-ok="1" aria-label="Samþykkja">${icon('check')}</button></li>`;
      }).join('')}</ul>
    </section>`;
}

function bindChoreButtons(root) {
  root.querySelectorAll('[data-chore]').forEach((b) => b.addEventListener('click', () => toggleChore(b.dataset.chore)));
  root.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => reviewChore(b.dataset.review, b.dataset.ok === '1')));
}

async function toggleChore(choreId) {
  const c = state.chores.find((x) => x.id === choreId);
  if (!c || state.me.role !== 'child') return;
  const log = logOf(c, state.me.id);
  if (log) {                                         // hætta við (ef foreldri hefur ekki samþykkt)
    if (log.approved_by) return;
    state.choreLogs = state.choreLogs.filter((l) => l.id !== log.id);
    renderView();
    try { await state.backend.deleteChoreLog(log.id); } catch { toast('Gat ekki vistað'); await loadChores(); renderView(); }
    return;
  }
  if (takenBy(c)) return toast('Einhver var á undan þér');
  const row = { chore_id: c.id, profile_id: state.me.id, day: todayIso(), status: c.needs_approval ? 'pending' : 'approved', points: c.points };
  const temp = { ...row, id: 'tmp-' + Date.now(), approved_by: null };
  state.choreLogs.push(temp);
  renderView();
  try {
    const id = await state.backend.addChoreLog(row);
    temp.id = id;
    if (row.status === 'pending') {
      toast('Sent til samþykkis');
      state.backend.choreDone(id).catch(() => {});
    } else {
      toast(`+${c.points} stig — vel gert!`);
    }
  } catch (e) {
    console.error(e);
    toast(c.mode === 'anyone' ? 'Einhver var á undan þér' : 'Gat ekki vistað — athugaðu netið');
  }
  await loadChores(); renderView();
}

async function reviewChore(logId, approve) {
  if (!isParent()) return;
  const log = state.choreLogs.find((l) => l.id === logId);
  if (!log) return;
  if (approve) Object.assign(log, { status: 'approved', approved_by: state.me.id });
  else state.choreLogs = state.choreLogs.filter((l) => l.id !== logId);
  renderView();
  try {
    await state.backend.choreReview(logId, approve, state.me.id);
    toast(approve ? `Samþykkt (+${log.points} stig til ${firstName(profileById(log.profile_id)?.name || '')})` : 'Sent til baka');
  } catch (e) {
    console.error(e);
    toast('Gat ekki vistað — athugaðu netið');
    await loadChores(); renderView();
  }
}

function renderChores(view) {
  if (!state.chores.length && state.backend.mode === 'live' && !isParent()) {
    view.innerHTML = `<section class="hero compact"><h1>Verk</h1></section>
      <div class="empty"><div class="empty-mark">${icon('list-checks')}</div><p>Engin verk ennþá</p></div>`;
    return;
  }
  const mon = mondayIso();
  const rows = leaderboard(mon);
  const holders = trophyHolders();
  const holderNames = holders.ids.map((id) => firstName(profileById(id)?.name || ''));

  const board = `
    <section class="card board">
      <div class="card-head">
        <div class="card-label">${icon('trophy')} Stigatafla vikunnar</div>
        <span class="muted small">${esc(weekRange(fromIso(mon)))}</span>
      </div>
      <ol class="board-list">${rows.map((r, i) => `
        <li class="${r.kid.id === state.me.id ? 'me' : ''}">
          <span class="rank r${r.points ? rankIn(rows, r.points) : 0}">${r.points ? rankIn(rows, r.points) : '–'}</span>
          ${withTrophy(r.kid, '')}
          <span class="board-name">${esc(firstName(r.kid.name))}</span>
          <span class="board-pts"><strong>${r.points}</strong> ${icon('star', 'fill')}${r.pending ? `<span class="muted small"> +${r.pending} bíða</span>` : ''}</span>
        </li>`).join('')}</ol>
      <p class="muted small board-foot">${holders.ids.length
        ? `${icon('trophy')} Bikarinn: ${esc(holderNames.join(' og '))} (${holders.points} stig síðustu viku)`
        : `${icon('trophy')} Sá sem er efstur á sunnudagskvöld fær bikarinn`}</p>
    </section>`;

  let mine = '';
  if (state.me.role === 'child') {
    const list = choresToday(state.me.id);
    mine = `
      <section class="card">
        <div class="card-label">${icon('list-checks')} Verkin mín í dag</div>
        ${list.length ? `<ul class="chore-list">${list.map((c) => choreRow(c, state.me.id)).join('')}</ul>` : '<p class="muted">Engin verk í dag</p>'}
        <p class="muted small">Ýttu á verk þegar það er búið. Stærri verk þarf mamma eða pabbi að samþykkja.</p>
      </section>
      ${laterThisWeek(state.me.id)}`;
  }

  let parentView = '';
  if (isParent()) {
    const today = kids().map((k) => {
      const list = choresToday(k.id);
      const done = list.filter((c) => logOf(c, k.id)?.status === 'approved').length;
      const icons = list.map((c) => {
        const l = logOf(c, k.id), o = !l && takenBy(c);
        const st = l ? (l.status === 'approved' ? 'ok' : 'wait') : o ? 'other' : 'todo';
        return `<span class="mini-chore ${st}" title="${esc(c.title)}">${esc(c.emoji)}</span>`;
      }).join('');
      return `<li>${avatar(k, 'sm')}<span class="kid-name">${esc(firstName(k.name))}</span>
        <span class="mini-chores">${icons}</span><span class="muted small">${done}/${list.length}</span></li>`;
    }).join('');
    parentView = `
      ${approvalsCard()}
      <section class="card">
        <div class="card-label">${icon('clipboard-list')} Staðan í dag</div>
        <ul class="kid-today">${today}</ul>
        <p class="muted small">Grænt = búið · gult = bíður samþykkis · grátt = ekki búið</p>
      </section>
      <button class="btn big" id="manage-chores">${icon('settings')} Sýsla með verkin</button>`;
  }

  // Bara foreldrar sjá stigatöfluna; börnin sjá sín eigin stig
  let myPoints = '';
  if (state.me.role === 'child') {
    const t = weekTotals(mon)[state.me.id] || { points: 0, pending: 0 };
    myPoints = `
      <section class="card board my-points">
        <div class="card-label">${icon('star', 'fill')} Stigin mín í vikunni</div>
        <div class="big-points">${t.points}<span> stig</span></div>
        ${t.pending ? `<p class="muted small">+${t.pending} bíða samþykkis</p>` : ''}
        ${holders.ids.includes(state.me.id) ? `<p class="trophy-line">${icon('trophy')} Þú ert með bikarinn!</p>` : ''}
      </section>`;
  }

  view.innerHTML = `
    <section class="hero compact"><h1>Verk</h1></section>
    ${isParent() ? board : myPoints}
    ${mine}
    ${parentView}`;
  bindChoreButtons(view);
  view.querySelector('#manage-chores')?.addEventListener('click', openChoreList);
}

function daysSummary(days) {
  const d = WEEK_ORDER.filter((x) => (days || []).includes(x));
  const key = d.join(',');
  if (d.length === 7) return 'Alla daga';
  if (key === '1,2,3,4,5') return 'Virka daga';
  if (key === '6,0') return 'Um helgar';
  const names = d.map((x) => DAYS_ACC[x]);
  const s = names.length > 1 ? names.slice(0, -1).join(', ') + ' og ' + names.at(-1) : names[0] || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function openChoreList() {
  const s = openSheet(`
    <h2>Verkin</h2>
    <ul class="rem-all">${state.chores.map((c) => {
      const who = (c.to_ids || []).length ? c.to_ids.map((id) => firstName(profileById(id)?.name || '')).join(', ') : 'Öll börnin';
      return `<li><button data-edit-chore="${esc(c.id)}">
        <span class="rem-body">${esc(c.emoji)} ${esc(c.title)} <span class="pts">${c.points} ${icon('star', 'fill')}</span></span>
        <span class="muted small">${esc(daysSummary(c.repeat_days))} · ${esc(who)} · ${c.mode === 'anyone' ? 'fyrstur fær' : 'hver og einn'}${c.needs_approval ? ' · samþykki' : ''}</span>
      </button></li>`;
    }).join('')}</ul>
    <div class="sheet-actions">
      <button class="btn primary" id="new-chore">${icon('plus')} Nýtt verk</button>
      <button class="btn" data-close>Loka</button>
    </div>`);
  s.el.querySelector('#new-chore').addEventListener('click', () => { s.close(); setTimeout(() => openChoreEditor(null), 230); });
  s.el.querySelectorAll('[data-edit-chore]').forEach((b) => b.addEventListener('click', () => {
    s.close(); setTimeout(() => openChoreEditor(state.chores.find((c) => c.id === b.dataset.editChore)), 230);
  }));
}

function openChoreEditor(existing) {
  const c = existing || { emoji: '🧹', points: 5, mode: 'each', needs_approval: false, to_ids: [], repeat_days: [0, 1, 2, 3, 4, 5, 6] };
  let mode = c.mode;
  let points = c.points;
  let days = new Set(c.repeat_days);
  let to = new Set(c.to_ids || []);
  const POINTS = [2, 3, 5, 10, 15, 20, 30];
  const s = openSheet(`
    <h2>${existing ? 'Breyta verki' : 'Nýtt verk'}</h2>
    <div class="emoji-title">
      <label class="field emoji-field"><span>Tákn</span><input id="ch-emoji" maxlength="4" value="${esc(c.emoji)}"></label>
      <label class="field"><span>Verk</span><input id="ch-title" maxlength="60" value="${esc(c.title || '')}" placeholder="t.d. Vökva blómin"></label>
    </div>
    <div class="card-label">Stig</div>
    <div class="chips" id="ch-points">${POINTS.map((p) => `<button class="chip pick-chip ${p === points ? 'on' : ''}" data-points="${p}">${p} ${icon('star', 'fill')}</button>`).join('')}</div>
    <div class="card-label">Hver gerir það?</div>
    <div class="segmented">
      <button data-mode="each" class="${mode === 'each' ? 'on' : ''}">Hver og einn</button>
      <button data-mode="anyone" class="${mode === 'anyone' ? 'on' : ''}">Fyrstur fær</button>
    </div>
    <div class="filters wrap" id="ch-to">
      <button class="filter ${to.size ? '' : 'on'}" data-to="all" style="--c:var(--accent)"><span>Öll börnin</span></button>
      ${kids().map((k) => `<button class="filter ${to.has(k.id) ? 'on' : ''}" data-to="${esc(k.id)}" style="--c:${esc(k.color)}">${avatar(k, 'sm')}<span>${esc(firstName(k.name))}</span></button>`).join('')}
    </div>
    <div class="card-label">Hvenær</div>
    <div class="day-chips">${WEEK_ORDER.map((d) => `<button class="day-chip ${days.has(d) ? 'on' : ''}" data-day="${d}">${DAYS_SHORT[d]}</button>`).join('')}</div>
    <div class="chips quick-days">
      <button class="chip quick" data-preset="all">Alla daga</button>
      <button class="chip quick" data-preset="week">Virka daga</button>
      <button class="chip quick" data-preset="weekend">Um helgar</button>
    </div>
    <label class="toggle-row"><input type="checkbox" id="ch-approve" ${c.needs_approval ? 'checked' : ''}><span>Foreldri þarf að samþykkja</span></label>
    <div class="sheet-actions">
      <button class="btn primary big" id="ch-save">Vista</button>
      ${existing ? '<button class="btn danger-text" id="ch-del">Eyða verki</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  el.querySelectorAll('[data-points]').forEach((b) => b.addEventListener('click', () => {
    points = Number(b.dataset.points);
    el.querySelectorAll('[data-points]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const paintTo = () => el.querySelectorAll('[data-to]').forEach((b) =>
    b.classList.toggle('on', b.dataset.to === 'all' ? !to.size : to.has(b.dataset.to)));
  el.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.to;
    if (id === 'all') to.clear(); else if (to.has(id)) to.delete(id); else to.add(id);
    if (to.size === kids().length) to.clear();
    paintTo();
  }));
  const paintDays = () => el.querySelectorAll('[data-day]').forEach((b) => b.classList.toggle('on', days.has(Number(b.dataset.day))));
  el.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    if (days.has(d)) days.delete(d); else days.add(d);
    paintDays();
  }));
  el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    days = new Set({ all: [0, 1, 2, 3, 4, 5, 6], week: [1, 2, 3, 4, 5], weekend: [6, 0] }[b.dataset.preset]);
    paintDays();
  }));
  el.querySelector('#ch-save').addEventListener('click', async () => {
    const title = el.querySelector('#ch-title').value.trim();
    if (!title) { el.querySelector('#ch-title').focus(); return toast('Skrifaðu heiti á verkinu'); }
    if (!days.size) return toast('Veldu að minnsta kosti einn dag');
    const row = {
      ...(existing ? { id: existing.id } : { sort: state.chores.length + 1 }),
      title, emoji: el.querySelector('#ch-emoji').value.trim() || '🧹', points, mode,
      needs_approval: el.querySelector('#ch-approve').checked,
      to_ids: [...to], repeat_days: [...days].sort(),
    };
    try {
      await state.backend.saveChore(row);
      await loadChores(); s.close(); renderView();
      toast(existing ? 'Verk uppfært' : 'Nýtt verk komið');
    } catch (e) { console.error(e); toast('Gat ekki vistað — er búið að keyra 5-heimilisverk.sql?'); }
  });
  el.querySelector('#ch-del')?.addEventListener('click', async () => {
    try { await state.backend.deleteChore(existing.id); await loadChores(); s.close(); renderView(); toast('Verki eytt'); }
    catch { toast('Gat ekki eytt'); }
  });
}

// ------------------------------------------------------------------
// Áminningar
// ------------------------------------------------------------------
const DAYS_ACC = ['sunnudaga', 'mánudaga', 'þriðjudaga', 'miðvikudaga', 'fimmtudaga', 'föstudaga', 'laugardaga'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];                   // mánudagur fyrst

async function loadReminders() {
  try {
    const [list, done] = await Promise.all([state.backend.listReminders(), state.backend.listDone(todayIso())]);
    state.reminders = list || [];
    state.remDone = new Set((done || []).map((d) => d.reminder_id + '|' + d.profile_id));
  } catch (e) { state.reminders = []; }       // töflurnar ekki til ennþá
}

const remOn = (r, dayIso) => (r.once_date ? r.once_date === dayIso : (r.repeat_days || []).includes(fromIso(dayIso).getDay()));
const remTime = (r) => (r.remind_at ? String(r.remind_at).slice(0, 5) : '');
const canEditRem = (r) => isParent() || r.created_by === state.me.id;
const remIsDone = (r) => state.remDone.has(r.id + '|' + state.me.id);

function remSummary(r) {
  let when;
  if (r.once_date) {
    const t = todayIso(), tm = iso(addDays(new Date(), 1));
    when = r.once_date === t ? 'Í dag' : r.once_date === tm ? 'Á morgun' : longDate(fromIso(r.once_date));
  } else {
    const d = WEEK_ORDER.filter((x) => (r.repeat_days || []).includes(x));
    const key = d.join(',');
    if (d.length === 7) when = 'Alla daga';
    else if (key === '1,2,3,4,5') when = 'Virka daga';
    else if (key === '6,0') when = 'Um helgar';
    else {
      const names = d.map((x) => DAYS_ACC[x]);
      when = names.length > 1 ? names.slice(0, -1).join(', ') + ' og ' + names.at(-1) : names[0] || '';
      when = when.charAt(0).toUpperCase() + when.slice(1);
    }
  }
  return remTime(r) ? `${when} kl. ${remTime(r)}` : when;
}

function remindersCard() {
  const today = todayIso();
  // Áminningar sem búið er að haka við hverfa (endurteknar koma aftur næst)
  const todays = state.reminders.filter((r) => (!r.to_id || r.to_id === state.me.id) && remOn(r, today));
  const mine = todays
    .filter((r) => !remIsDone(r))
    .sort((a, b) => (remTime(a) || '00').localeCompare(remTime(b) || '00'));
  return `
    <section class="card reminders">
      <div class="card-head">
        <div class="card-label">${icon('pin')} Áminningar</div>
        <button class="link small" id="rem-all">Allar ›</button>
      </div>
      ${mine.length ? `<ul class="rem-list">${mine.map((r) => {
        const done = remIsDone(r);
        return `<li class="${done ? 'done' : ''}">
          <button class="rem-check" data-rem-done="${esc(r.id)}" aria-label="${done ? 'Ekki búið' : 'Búið'}: ${esc(r.body)}">
            <span class="box">${done ? icon('check') : ''}</span>
            <span class="rem-text"><span class="rem-body">${esc(r.body)}</span>
              ${remTime(r) || !r.to_id ? `<span class="muted small">${remTime(r) ? 'kl. ' + esc(remTime(r)) : ''}${remTime(r) && !r.to_id ? ' · ' : ''}${!r.to_id ? 'öll fjölskyldan' : ''}</span>` : ''}</span>
          </button></li>`;
      }).join('')}</ul>` : `<p class="muted rem-empty">${todays.length ? 'Allt búið í dag' : 'Engar áminningar í dag.'}</p>`}
      <button class="btn add-rem" id="rem-add">${icon('plus')} Ný áminning</button>
    </section>`;
}

async function toggleRemDone(id) {
  const key = id + '|' + state.me.id;
  const done = !state.remDone.has(key);
  if (done) state.remDone.add(key); else state.remDone.delete(key);
  if (done) {
    const li = document.querySelector(`[data-rem-done="${CSS.escape(id)}"]`)?.closest('li');
    if (li) { li.classList.add('done', 'leaving'); await new Promise((r) => setTimeout(r, 350)); }
  }
  renderView();
  try { await state.backend.setDone(id, todayIso(), state.me.id, done); }
  catch { toast('Gat ekki vistað — athugaðu netið'); await loadReminders(); renderView(); }
}

function openReminderSheet(existing = null, onClose = null) {
  const r = existing || {};
  const editing = Boolean(existing);
  let to = editing ? (r.to_id || 'allir') : state.me.id;
  let mode = r.once_date ? 'once' : 'repeat';
  let days = new Set(editing ? (r.repeat_days || []) : [new Date().getDay()]);
  const pushOn = editing ? Boolean(r.remind_at) : true;

  const people = isParent()
    ? `<div class="card-label">Fyrir hvern</div>
       <div class="filters wrap" id="rem-to">
         <button class="filter ${to === 'allir' ? 'on' : ''}" data-to="allir" style="--c:var(--accent)">${famAv()}<span>Allir</span></button>
         ${state.profiles.map((p) => `<button class="filter ${to === p.id ? 'on' : ''}" data-to="${esc(p.id)}" style="--c:${esc(p.color)}">${avatar(p, 'sm')}<span>${esc(p.id === state.me.id ? 'Ég' : firstName(p.name))}</span></button>`).join('')}
       </div>` : '';

  const s = openSheet(`
    <h2>${editing ? 'Breyta áminningu' : 'Ný áminning'}</h2>
    <label class="field"><span>Hvað á að muna?</span>
      <input id="rem-body" maxlength="120" value="${esc(r.body || '')}" placeholder="t.d. Sunddót í skólann"></label>
    ${people}
    <div class="card-label">Hvenær</div>
    <div class="segmented" role="tablist">
      <button data-mode="repeat" class="${mode === 'repeat' ? 'on' : ''}">Endurtekið</button>
      <button data-mode="once" class="${mode === 'once' ? 'on' : ''}">Einu sinni</button>
    </div>
    <div id="rem-repeat" ${mode === 'repeat' ? '' : 'hidden'}>
      <div class="day-chips">${WEEK_ORDER.map((d) => `<button class="day-chip ${days.has(d) ? 'on' : ''}" data-day="${d}">${DAYS_SHORT[d]}</button>`).join('')}</div>
      <div class="chips quick-days">
        <button class="chip quick" data-preset="all">Alla daga</button>
        <button class="chip quick" data-preset="week">Virka daga</button>
        <button class="chip quick" data-preset="weekend">Um helgar</button>
      </div>
    </div>
    <div id="rem-once" ${mode === 'once' ? '' : 'hidden'}>
      <input type="date" id="rem-date" value="${esc(r.once_date || todayIso())}" min="${todayIso()}">
    </div>
    <label class="toggle-row">
      <input type="checkbox" id="rem-push" ${pushOn ? 'checked' : ''}>
      <span>Senda tilkynningu í símann kl.</span>
      <input type="time" id="rem-time" value="${esc(remTime(r) || '07:30')}">
    </label>
    <div class="sheet-actions">
      <button class="btn primary big" id="rem-save">Vista</button>
      ${editing && canEditRem(r) ? '<button class="btn danger-text" id="rem-del">Eyða áminningu</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);

  const el = s.el;
  const close = () => { s.close(); if (onClose) setTimeout(onClose, 230); };
  el.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
    to = b.dataset.to;
    el.querySelectorAll('[data-to]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('#rem-repeat').hidden = mode !== 'repeat';
    el.querySelector('#rem-once').hidden = mode !== 'once';
  }));
  const paintDays = () => el.querySelectorAll('[data-day]').forEach((b) => b.classList.toggle('on', days.has(Number(b.dataset.day))));
  el.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    if (days.has(d)) days.delete(d); else days.add(d);
    paintDays();
  }));
  el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    days = new Set({ all: [0, 1, 2, 3, 4, 5, 6], week: [1, 2, 3, 4, 5], weekend: [6, 0] }[b.dataset.preset]);
    paintDays();
  }));
  const timeInput = el.querySelector('#rem-time');
  const pushBox = el.querySelector('#rem-push');
  const syncTime = () => { timeInput.disabled = !pushBox.checked; };
  pushBox.addEventListener('change', syncTime); syncTime();

  el.querySelector('#rem-save').addEventListener('click', async () => {
    const body = el.querySelector('#rem-body').value.trim();
    if (!body) { el.querySelector('#rem-body').focus(); return toast('Skrifaðu hvað á að muna'); }
    if (mode === 'repeat' && !days.size) return toast('Veldu að minnsta kosti einn dag');
    const date = el.querySelector('#rem-date').value;
    if (mode === 'once' && !date) return toast('Veldu dag');
    const row = {
      ...(editing ? { id: r.id } : { created_by: state.me.id }),
      to_id: isParent() ? (to === 'allir' ? null : to) : state.me.id,
      body,
      repeat_days: mode === 'repeat' ? [...days].sort() : [],
      once_date: mode === 'once' ? date : null,
      remind_at: pushBox.checked && timeInput.value ? timeInput.value : null,
    };
    try {
      await state.backend.saveReminder(row);
      await loadReminders();
      close(); renderView();
      toast(editing ? 'Áminning uppfærð' : 'Áminning komin');
    } catch (e) {
      console.error(e);
      toast('Gat ekki vistað — er búið að uppfæra gagnagrunninn (4-aminningar.sql)?');
    }
  });
  el.querySelector('#rem-del')?.addEventListener('click', async () => {
    try {
      await state.backend.deleteReminder(r.id);
      await loadReminders();
      close(); renderView(); toast('Áminningu eytt');
    } catch { toast('Gat ekki eytt'); }
  });
  if (!editing) setTimeout(() => el.querySelector('#rem-body').focus(), 250);
}

function openAllReminders() {
  const today = todayIso();
  const visible = state.reminders.filter((r) =>
    (isParent() || !r.to_id || r.to_id === state.me.id) && !(r.once_date && r.once_date < today));
  const groups = [
    { id: null, label: 'Öll fjölskyldan', icon: famAv() },
    ...state.profiles.map((p) => ({ id: p.id, label: p.name, icon: avatar(p, 'sm') })),
  ].map((g) => ({ ...g, list: visible.filter((r) => (r.to_id || null) === g.id) })).filter((g) => g.list.length);

  const s = openSheet(`
    <h2>Áminningar</h2>
    ${groups.length ? groups.map((g) => `
      <section class="rem-group">
        <div class="rem-group-head">${g.icon}<strong>${esc(g.label)}</strong></div>
        <ul class="rem-all">${g.list.map((r) => `
          <li><button data-edit="${esc(r.id)}" ${canEditRem(r) ? '' : 'disabled'}>
            <span class="rem-body">${esc(r.body)}</span>
            <span class="muted small">${esc(remSummary(r))}</span>
          </button></li>`).join('')}</ul>
      </section>`).join('') : '<p class="muted">Engar áminningar ennþá.</p>'}
    <div class="sheet-actions">
      <button class="btn primary" id="rem-new">${icon('plus')} Ný áminning</button>
      <button class="btn" data-close>Loka</button>
    </div>`);
  s.el.querySelector('#rem-new').addEventListener('click', () => { s.close(); setTimeout(() => openReminderSheet(null, openAllReminders), 230); });
  s.el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const r = state.reminders.find((x) => x.id === b.dataset.edit);
    if (!r || !canEditRem(r)) return;
    s.close(); setTimeout(() => openReminderSheet(r, openAllReminders), 230);
  }));
}

// ------------------------------------------------------------------
// Tilkynningar
// ------------------------------------------------------------------
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Skilaboð sjást á forsíðunni í 1 klukkutíma
const NOTICE_TTL = 60 * 60 * 1000;

async function loadNotices() {
  try { state.notices = await state.backend.listNotices(new Date(Date.now() - NOTICE_TTL).toISOString()); }
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
  const fresh = Date.now() - NOTICE_TTL;
  const mine = state.notices
    .filter((n) => (!n.to_id || n.to_id === state.me.id) && !hidden.has(n.id) && new Date(n.created_at) > fresh)
    .slice(0, 3);
  if (!mine.length) return '';
  return `
    <section class="card notices">
      <div class="card-label">${icon('megaphone')} Skilaboð</div>
      <ul class="notice-list">
        ${mine.map((n) => {
          const from = profileById(n.from_id);
          return `<li>${avatar(from, 'sm')}<div class="notice-text"><p class="notice-body">${esc(n.body)}</p>
            <p class="muted small">${esc(from ? firstName(from.name) : '')}${n.to_id ? ' · bara til þín' : ''} · ${esc(relTime(n.created_at))}</p></div>
            <button class="notice-close" data-dismiss="${esc(n.id)}" aria-label="Loka skilaboðum">${icon('x')}</button></li>`;
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
      <div class="card-label">${icon('bell')} Tilkynningar</div>
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
      ? `<p class="menu-note">${icon('bell')} Opnaðu appið af heimaskjánum til að geta fengið tilkynningar.</p>`
      : `<p class="menu-note">${icon('bell-off')} Þessi vafri styður ekki tilkynningar.</p>`;
  }
  if (Notification.permission === 'granted') return `<p class="menu-note">${icon('bell')} Kveikt á tilkynningum í þessum síma</p>`;
  if (Notification.permission === 'denied') {
    return `<p class="menu-note">${icon('bell-off')} Tilkynningar eru bannaðar. Leyfðu þær í Stillingum símans → Tilkynningar → Fjölskyldan.</p>`;
  }
  return `<button id="enable-push">${icon('bell')} Kveikja á tilkynningum</button>`;
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
    toast('Kveikt á tilkynningum');
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
    <h2>Senda tilkynningu</h2>
    <div class="card-label">Til</div>
    <div class="filters wrap" id="to-list">
      <button class="filter on" data-to="allir" style="--c:var(--accent)">${famAv()}<span>Allir</span></button>
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
      else toast(`Sent (${res.sent} af ${res.devices} ${res.devices === 1 ? 'síma' : 'símum'})`);
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
