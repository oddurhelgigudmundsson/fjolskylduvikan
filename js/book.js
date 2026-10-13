// Upplýsingabók fjölskyldunnar: opnast úr valmyndinni (ýtt á myndina þína efst).
// - Heimilið: WiFi (QR-kóði fyrir gesti) og kóðar. Foreldrar geta falið atriði fyrir börnunum.
// - Afmæli: fjölskyldan (fæðingardagur á prófíl) og stórfjölskyldan. Kort á forsíðu á afmælisdeginum.
// - Stærðir: foreldrar fylla inn; börn 15 ára og eldri geta breytt sínum. Sjást líka á óskalistanum.
import { icon } from './icons.js';
import { esc, firstName, MONTHS } from './util.js';

let ctx = null;              // { state, backend, avatar, profileById, isParent, toast, openSheet, renderView, go }
const revealed = new Set();  // atriði þar sem lykilorðið er sýnilegt (bara í þessari heimsókn)

export function initBook(c) { ctx = c; }

export async function loadBook() {
  const { state, backend } = ctx;
  const [info, birthdays, sizes] = await Promise.all([
    backend.listInfo().catch(() => null),
    backend.listBirthdays().catch(() => null),
    backend.listSizes().catch(() => null),
  ]);
  state.bookReady = info !== null;
  state.info = info || [];
  state.birthdays = birthdays || [];
  state.sizes = sizes || [];
}

// ------------------------------------------------------------------
// Afmæli og aldur
// ------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dateLabel = (m, d) => `${d}. ${MONTHS[m - 1]}`;

export function ageOf(profile, on = new Date()) {
  if (!profile?.birthday) return null;
  const [y, m, d] = profile.birthday.split('-').map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

// Allir afmælisdagar: fjölskyldan + stórfjölskyldan, raðað eftir hvað er næst
function allBirthdays() {
  const { state } = ctx;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = [
    ...state.profiles.filter((p) => p.birthday).map((p) => {
      const [y, m, d] = p.birthday.split('-').map(Number);
      return { key: 'p:' + p.id, profile: p, name: p.name, month: m, day: d, year: y };
    }),
    ...state.birthdays.map((b) => ({ key: 'b:' + b.id, row: b, name: b.name, month: b.month, day: b.day, year: b.year })),
  ];
  for (const r of rows) {
    let next = new Date(today.getFullYear(), r.month - 1, r.day);
    if (next < today) next = new Date(today.getFullYear() + 1, r.month - 1, r.day);
    r.inDays = Math.round((next - today) / 86400000);
    r.turns = r.year ? next.getFullYear() - r.year : null;
  }
  return rows.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, 'is'));
}

// Kort á forsíðunni — bara á afmælisdeginum sjálfum
export function birthdayHomeCard() {
  if (!ctx) return '';
  const { state, avatar } = ctx;
  const today = allBirthdays().filter((r) => r.inDays === 0);
  if (!today.length) return '';
  return `
    <section class="card birthday-card">
      <div class="card-label">${icon('cake')} Afmæli í dag</div>
      ${today.map((r) => {
        const me = r.profile?.id === state.me.id;
        const age = r.turns ? ` · ${r.turns} ára` : '';
        return `<div class="bday-row">${r.profile ? avatar(r.profile, 'sm') : '<span class="bday-cake">🎂</span>'}
          <div><strong>${me ? 'Til hamingju með daginn!' : esc(r.profile ? firstName(r.name) : r.name)}</strong>
          <span class="muted small">${me ? `Þú átt afmæli í dag${esc(age)} 🎉` : `á afmæli í dag${esc(age)}`}</span></div></div>`;
      }).join('')}
    </section>`;
}

// ------------------------------------------------------------------
// Stærðir
// ------------------------------------------------------------------
const SIZE_FIELDS = [['clothes', 'Föt'], ['pants', 'Buxur'], ['shoes', 'Skór'], ['other', 'Annað']];

export function canEditSizes(target) {
  const { state, isParent } = ctx;
  if (isParent()) return true;
  return target.id === state.me.id && (ageOf(state.me) ?? 0) >= 15;
}

export function sizesLine(profileId) {
  if (!ctx) return '';
  const s = ctx.state.sizes.find((x) => x.profile_id === profileId);
  if (!s) return '';
  return SIZE_FIELDS.filter(([k]) => s[k]).map(([k, label]) => `${label} ${s[k]}`).join(' · ');
}

// ------------------------------------------------------------------
// Síðan sjálf
// ------------------------------------------------------------------
export function renderBook(view) {
  const { state, avatar, isParent } = ctx;
  const parent = isParent();
  const items = state.info.filter((x) => parent || !x.parents_only);
  const bdays = allBirthdays();
  const noBirthday = state.profiles.filter((p) => !p.birthday);
  const people = [...state.profiles].sort((a, b) => (a.role === b.role ? a.sort - b.sort : a.role === 'child' ? -1 : 1));

  const itemRow = (x) => {
    const show = revealed.has(x.id);
    const secret = x.value ? (show ? esc(x.value) : '•'.repeat(Math.min(10, Math.max(6, x.value.length)))) : '<span class="muted">—</span>';
    return `
      <li class="book-row">
        <span class="book-ic">${icon(x.kind === 'wifi' ? 'wifi' : 'key-round')}</span>
        <button class="book-main" ${parent ? `data-info-edit="${esc(x.id)}"` : 'disabled'}>
          <span class="book-title">${esc(x.title)}${x.parents_only ? ` <span class="pill">${icon('lock')} Bara foreldrar</span>` : ''}</span>
          <span class="book-value ${show ? 'shown' : ''}">${secret}</span>
        </button>
        ${x.value ? `<button class="icon-btn" data-reveal="${esc(x.id)}" aria-label="${show ? 'Fela' : 'Sýna'}">${icon(show ? 'eye-off' : 'eye')}</button>` : ''}
        ${x.kind === 'wifi' ? `<button class="icon-btn" data-qr="${esc(x.id)}" aria-label="QR-kóði fyrir gesti">${icon('qr-code')}</button>` : ''}
      </li>`;
  };

  view.innerHTML = `
    <section class="hero compact">
      <button class="link small back-link" data-go="home">${icon('chevron-left')} Heim</button>
      <h1>Upplýsingabók</h1>
    </section>
    ${state.bookReady ? '' : `<p class="muted small">${icon('plug')} Það þarf að keyra 9-upplysingabok.sql í Supabase fyrst.</p>`}

    <section class="card">
      <div class="card-label">${icon('house')} Heimilið</div>
      ${items.length ? `<ul class="book-list">${items.map(itemRow).join('')}</ul>` : '<p class="muted">Ekkert skráð ennþá.</p>'}
      ${parent ? `<button class="btn add-rem" id="info-add">${icon('plus')} Bæta við WiFi eða kóða</button>` : ''}
    </section>

    <section class="card">
      <div class="card-label">${icon('cake')} Afmæli</div>
      ${bdays.length ? `<ul class="book-list">${bdays.map((r) => `
        <li class="book-row">
          ${r.profile ? avatar(r.profile, 'sm') : `<span class="book-ic">${icon('cake')}</span>`}
          <button class="book-main" ${r.profile ? (parent ? `data-bday-family="${esc(r.profile.id)}"` : 'disabled') : `data-bday-edit="${esc(r.row.id)}"`}>
            <span class="book-title">${esc(r.name)}</span>
            <span class="muted small">${esc(dateLabel(r.month, r.day))}${r.turns ? (r.inDays === 0 ? ` · ${r.turns} ára í dag` : ` · verður ${r.turns} ára`) : ''}</span>
          </button>
          <span class="book-when ${r.inDays === 0 ? 'today' : ''}">${r.inDays === 0 ? 'Í dag 🎂' : r.inDays === 1 ? 'Á morgun' : `eftir ${r.inDays} d.`}</span>
        </li>`).join('')}</ul>` : '<p class="muted">Engin afmæli skráð ennþá.</p>'}
      <button class="btn add-rem" id="bday-add">${icon('plus')} Bæta við afmæli</button>
      ${parent && noBirthday.length ? `
        <p class="muted small">Fæðingardag vantar hjá:</p>
        <div class="filters wrap">${noBirthday.map((p) => `<button class="filter" data-bday-family="${esc(p.id)}" style="--c:${esc(p.color)}">${avatar(p, 'sm')}<span>${esc(firstName(p.name))}</span></button>`).join('')}</div>` : ''}
    </section>

    <section class="card">
      <div class="card-label">${icon('shirt')} Stærðir</div>
      <ul class="book-list">${people.map((p) => {
        const line = sizesLine(p.id);
        const can = canEditSizes(p);
        return `
        <li class="book-row">
          ${avatar(p, 'sm')}
          <button class="book-main" ${can ? `data-sizes="${esc(p.id)}"` : 'disabled'}>
            <span class="book-title">${esc(firstName(p.name))}</span>
            <span class="${line ? '' : 'muted '}small">${line ? esc(line) : 'Ekkert skráð'}</span>
          </button>
          ${can ? `<span class="book-edit">${icon('pencil')}</span>` : ''}
        </li>`;
      }).join('')}</ul>
      <p class="muted small">Foreldrar fylla inn. 15 ára og eldri geta breytt sínum eigin.</p>
    </section>`;

  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ctx.go(b.dataset.go)));
  view.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.reveal;
    revealed.has(id) ? revealed.delete(id) : revealed.add(id);
    renderBook(view);
  }));
  view.querySelectorAll('[data-qr]').forEach((b) => b.addEventListener('click', () => openQr(state.info.find((x) => x.id === b.dataset.qr))));
  view.querySelector('#info-add')?.addEventListener('click', () => openInfoEditor());
  view.querySelectorAll('[data-info-edit]').forEach((b) => b.addEventListener('click', () => openInfoEditor(state.info.find((x) => x.id === b.dataset.infoEdit))));
  view.querySelector('#bday-add').addEventListener('click', () => openBirthdayEditor());
  view.querySelectorAll('[data-bday-edit]').forEach((b) => b.addEventListener('click', () => openBirthdayEditor(state.birthdays.find((x) => x.id === b.dataset.bdayEdit))));
  view.querySelectorAll('[data-bday-family]').forEach((b) => b.addEventListener('click', () => openFamilyBirthday(ctx.profileById(b.dataset.bdayFamily))));
  view.querySelectorAll('[data-sizes]').forEach((b) => b.addEventListener('click', () => openSizes(ctx.profileById(b.dataset.sizes))));
}

// ------------------------------------------------------------------
// WiFi sem QR-kóði (síminn skannar og tengist)
// ------------------------------------------------------------------
const wifiEsc = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');

async function openQr(item) {
  if (!item) return;
  let svg = '';
  try {
    const { default: qrcode } = await import('./vendor/qrcode.js');
    const qr = qrcode(0, 'M');
    qr.addData(`WIFI:T:${item.value ? 'WPA' : 'nopass'};S:${wifiEsc(item.title)};${item.value ? `P:${wifiEsc(item.value)};` : ''};`);
    qr.make();
    svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch (e) {
    console.error(e);
    return ctx.toast('Gat ekki búið til QR-kóðann');
  }
  ctx.openSheet(`
    <h2>${icon('wifi')} ${esc(item.title)}</h2>
    <p class="muted">Gesturinn beinir myndavélinni í símanum sínum að kóðanum og ýtir á „Tengjast“.</p>
    <div class="qr-box">${svg}</div>
    ${item.value ? `<p class="qr-pass">Lykilorð: <strong>${esc(item.value)}</strong></p>` : ''}
    <button class="btn" data-close>Loka</button>`);
}

// ------------------------------------------------------------------
// Skráning (blöð neðan frá)
// ------------------------------------------------------------------
function openInfoEditor(item) {
  let kind = item?.kind || 'wifi';
  const s = ctx.openSheet(`
    <h2>${item ? 'Breyta' : 'Bæta við'}</h2>
    <div class="segmented" id="info-kind">
      <button data-kind="wifi" class="${kind === 'wifi' ? 'on' : ''}">WiFi</button>
      <button data-kind="code" class="${kind === 'code' ? 'on' : ''}">Kóði eða annað</button>
    </div>
    <label class="field"><span id="info-title-label"></span>
      <input id="info-title" maxlength="60" value="${esc(item?.title || '')}" autocomplete="off"></label>
    <label class="field"><span id="info-value-label"></span>
      <input id="info-value" maxlength="120" value="${esc(item?.value || '')}" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
    <label class="toggle-row"><input type="checkbox" id="info-parents" ${item?.parents_only ? 'checked' : ''}><span>${icon('lock')} Bara foreldrar sjá þetta</span></label>
    <div class="sheet-actions">
      <button class="btn primary big" id="info-save">Vista</button>
      ${item ? '<button class="btn danger-text" id="info-del">Eyða</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  const labels = () => {
    el.querySelector('#info-title-label').textContent = kind === 'wifi' ? 'Nafn netsins (nákvæmlega eins og það birtist)' : 'Heiti, t.d. Lyklabox við útidyr';
    el.querySelector('#info-value-label').textContent = kind === 'wifi' ? 'Lykilorð' : 'Kóði eða upplýsingar';
  };
  labels();
  el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    el.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
    labels();
  }));
  el.querySelector('#info-save').addEventListener('click', async () => {
    const title = el.querySelector('#info-title').value.trim();
    if (!title) return ctx.toast(kind === 'wifi' ? 'Vantar nafn netsins' : 'Vantar heiti');
    try {
      await ctx.backend.saveInfo({
        ...(item ? { id: item.id } : {}), kind, title,
        value: el.querySelector('#info-value').value.trim(),
        parents_only: el.querySelector('#info-parents').checked,
      });
      s.close(); await loadBook(); ctx.renderView();
    } catch { ctx.toast('Gat ekki vistað — er búið að keyra 9-upplysingabok.sql?'); }
  });
  el.querySelector('#info-del')?.addEventListener('click', async () => {
    try { await ctx.backend.deleteInfo(item.id); s.close(); await loadBook(); ctx.renderView(); ctx.toast('Eytt'); }
    catch { ctx.toast('Gat ekki eytt'); }
  });
}

function dayMonthFields(m, d, y, yearHint) {
  return `
    <div class="date-row">
      <label class="field"><span>Dagur</span><input id="bd-day" type="number" inputmode="numeric" min="1" max="31" value="${d || ''}"></label>
      <label class="field grow"><span>Mánuður</span><select id="bd-month">${MONTHS.map((name, i) =>
        `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <label class="field"><span>Ár ${yearHint}</span><input id="bd-year" type="number" inputmode="numeric" min="1900" max="2100" value="${y || ''}"></label>
    </div>`;
}

function readDate(el, needYear) {
  const day = Number(el.querySelector('#bd-day').value);
  const month = Number(el.querySelector('#bd-month').value);
  const yearRaw = el.querySelector('#bd-year').value.trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const probe = new Date(year || 2000, month - 1, day);
  if (!day || probe.getMonth() !== month - 1 || probe.getDate() !== day) { ctx.toast('Dagsetningin passar ekki'); return null; }
  if (needYear && !year) { ctx.toast('Vantar ár'); return null; }
  if (year && (year < 1900 || year > new Date().getFullYear())) { ctx.toast('Árið passar ekki'); return null; }
  return { day, month, year };
}

function openBirthdayEditor(b) {
  const now = new Date();
  const s = ctx.openSheet(`
    <h2>${b ? 'Breyta afmæli' : 'Nýtt afmæli'}</h2>
    <label class="field"><span>Hver?</span><input id="bd-name" maxlength="60" placeholder="t.d. Amma Sigga" value="${esc(b?.name || '')}"></label>
    ${dayMonthFields(b?.month || now.getMonth() + 1, b?.day, b?.year, '<em class="muted">(valfrjálst)</em>')}
    <div class="sheet-actions">
      <button class="btn primary big" id="bd-save">Vista</button>
      ${b ? '<button class="btn danger-text" id="bd-del">Eyða</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  el.querySelector('#bd-save').addEventListener('click', async () => {
    const name = el.querySelector('#bd-name').value.trim();
    if (!name) return ctx.toast('Vantar nafn');
    const d = readDate(el, false);
    if (!d) return;
    try {
      await ctx.backend.saveBirthday({ ...(b ? { id: b.id } : { created_by: ctx.state.me.id }), name, ...d });
      s.close(); await loadBook(); ctx.renderView();
    } catch { ctx.toast('Gat ekki vistað — er búið að keyra 9-upplysingabok.sql?'); }
  });
  el.querySelector('#bd-del')?.addEventListener('click', async () => {
    try { await ctx.backend.deleteBirthday(b.id); s.close(); await loadBook(); ctx.renderView(); ctx.toast('Eytt'); }
    catch { ctx.toast('Gat ekki eytt'); }
  });
  if (!b) setTimeout(() => el.querySelector('#bd-name').focus(), 250);
}

// Fæðingardagur fjölskyldumeðlims (bara foreldrar)
function openFamilyBirthday(p) {
  if (!p) return;
  const [y, m, d] = (p.birthday || '').split('-').map(Number);
  const s = ctx.openSheet(`
    <h2>Fæðingardagur — ${esc(firstName(p.name))}</h2>
    <p class="muted small">Notað fyrir afmæliskortið á forsíðunni og til að vita hverjir eru orðnir 15 ára.</p>
    ${dayMonthFields(m || 1, d, y, '')}
    <div class="sheet-actions">
      <button class="btn primary big" id="bd-save">Vista</button>
      ${p.birthday ? '<button class="btn danger-text" id="bd-del">Taka út</button>' : ''}
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const el = s.el;
  const save = async (value) => {
    try {
      await ctx.backend.setProfileBirthday(p.id, value);
      p.birthday = value;
      s.close(); ctx.renderView();
    } catch (e) { ctx.toast(e.code === 'no_column' ? 'Það þarf að keyra 9-upplysingabok.sql fyrst' : 'Gat ekki vistað'); }
  };
  el.querySelector('#bd-save').addEventListener('click', () => {
    const v = readDate(el, true);
    if (v) save(`${v.year}-${pad(v.month)}-${pad(v.day)}`);
  });
  el.querySelector('#bd-del')?.addEventListener('click', () => save(null));
}

function openSizes(p) {
  if (!p || !canEditSizes(p)) return;
  const cur = ctx.state.sizes.find((x) => x.profile_id === p.id) || {};
  const s = ctx.openSheet(`
    <h2>Stærðir — ${esc(firstName(p.name))}</h2>
    ${SIZE_FIELDS.map(([k, label]) => `
      <label class="field"><span>${label}</span>
        <input data-size="${k}" maxlength="60" value="${esc(cur[k] || '')}" placeholder="${{ clothes: 't.d. 146 eða M', pants: 't.d. 146 eða 30/32', shoes: 't.d. 38', other: 't.d. Úlpa 152, hanskar S' }[k]}"></label>`).join('')}
    <div class="sheet-actions">
      <button class="btn primary big" id="sz-save">Vista</button>
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  s.el.querySelector('#sz-save').addEventListener('click', async () => {
    const row = { profile_id: p.id, updated_by: ctx.state.me.id };
    s.el.querySelectorAll('[data-size]').forEach((i) => { row[i.dataset.size] = i.value.trim() || null; });
    try { await ctx.backend.saveSizes(row); s.close(); await loadBook(); ctx.renderView(); ctx.toast('Stærðir vistaðar'); }
    catch { ctx.toast('Gat ekki vistað — er búið að keyra 9-upplysingabok.sql?'); }
  });
}
