import { createBackend } from './data.js';
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
  renderShell();
  await Promise.all([loadItems(), loadMeals()]);
  renderView();

  state.unsub.forEach((u) => u());
  state.unsub = [
    state.backend.subscribe('shopping_items', async () => { await loadItems(); refreshIf(['home', 'shop']); }),
    state.backend.subscribe('meals', async () => { await loadMeals(); refreshIf(['home', 'menu']); }),
  ];
}

// Síminn vaknar (app opnað aftur af heimaskjá) → sækja nýjustu gögn
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !state.me) return;
  await Promise.all([loadItems(), loadMeals()]);
  renderView();
});

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
  menu: '<svg viewBox="0 0 24 24"><path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.2 0-4 2.7-4 7s1.8 4 4 4"/></svg>',
};
const TABS = [
  { id: 'home', label: 'Heim' },
  { id: 'shop', label: 'Innkaup' },
  { id: 'menu', label: 'Matseðill' },
];

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <div class="title">Fjölskylduvikan</div>
      <button class="me-btn" id="me-btn" aria-label="Notandi: ${esc(state.me.name)}">${avatar(state.me)}</button>
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
}

function go(tab) {
  state.tab = tab;
  app.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  renderView();
  window.scrollTo({ top: 0 });
}

function renderView() {
  const view = document.getElementById('view');
  if (!view) return;
  ({ home: renderHome, shop: renderShop, menu: renderMenu }[state.tab])(view);
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
  const week = startOfWeek(now);
  const rest = [1, 2, 3, 4, 5, 6].map((n) => addDays(now, n)).filter((d) => d <= addDays(week, 6));

  view.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(longDate(now))}</p>
      <h1>${greet}, ${esc(firstName(state.me.name))} ${esc(state.me.emoji)}</h1>
    </section>

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

    ${rest.length ? `
    <section class="card">
      <div class="card-label">📅 Restin af vikunni</div>
      <ul class="week-mini">
        ${rest.map((d) => {
          const m = state.meals[iso(d)];
          return `<li><span class="day">${DAYS_SHORT[d.getDay()]}</span>
            <span class="${m ? '' : 'muted'}">${m ? esc(m.title) : 'Ekkert ákveðið'}</span></li>`;
        }).join('')}
      </ul>
    </section>` : ''}

    <p class="coming">Dagatal, heimilisverk og tilkynningar koma í næstu útgáfu ✨</p>`;

  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
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
  const monday = state.weekStart;
  const thisWeek = iso(startOfWeek(new Date())) === iso(monday);
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(monday, n));

  view.innerHTML = `
    <section class="hero compact"><h1>Matseðill</h1></section>
    <div class="week-nav">
      <button class="icon-btn" id="prev-week" aria-label="Fyrri vika">‹</button>
      <div class="week-label">
        <strong>${thisWeek ? 'Þessi vika' : `Vika ${isoWeek(monday)}`}</strong>
        <span class="muted">${esc(weekRange(monday))}</span>
      </div>
      <button class="icon-btn" id="next-week" aria-label="Næsta vika">›</button>
    </div>
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

  view.querySelector('#prev-week').addEventListener('click', () => shiftWeek(-7));
  view.querySelector('#next-week').addEventListener('click', () => shiftWeek(7));
  view.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => openMealSheet(b.dataset.day)));
}

async function shiftWeek(n) {
  state.weekStart = addDays(state.weekStart, n);
  renderView();
  await loadMeals();
  renderView();
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
      <button id="switch-user">🔄 Skipta um notanda</button>
      <button id="change-pin">🔢 Breyta PIN-inu mínu</button>
      ${isParent() && others.length ? `
        <div class="card-label">Gleymt PIN? Endurstilla fyrir:</div>
        ${others.map((p) => `<button data-reset="${esc(p.id)}">${avatar(p, 'sm')} ${esc(p.name)}</button>`).join('')}` : ''}
      ${state.backend.mode === 'live' ? '<button id="sign-out" class="danger-text">Skrá fjölskylduaðgang út úr þessum síma</button>' : ''}
    </div>`);

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
