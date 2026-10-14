// Tölfræðisíða: sækir nafnlausar heildartölur frá ÖLLUM fjölskyldum í config.js
// (action "stats" í clever-api, varið með ADMIN_KEY) og sýnir á einum stað.
import { FAMILIES } from './config.js';

const KEY = 'fv.adminkey';
const app = document.getElementById('app');
const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ekkert */ } };
const ddmm = (iso) => { const [, m, d] = iso.split('-'); return `${+d}.${+m}.`; };
const ago = (iso) => {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return days <= 0 ? 'í dag' : days === 1 ? 'í gær' : `fyrir ${days} d.`;
};

const families = Object.entries(FAMILIES).map(([code, f], i) => ({ code, ...f, color: `var(${SERIES[i % SERIES.length]})` }));

start();

function start() {
  const key = get(KEY);
  if (!key) return renderGate();
  load(key);
}

function renderGate(msg = '') {
  app.innerHTML = `
    <section class="gate">
      <h1>Tölfræði</h1>
      <p class="sub">Yfirlit yfir allar fjölskyldur. Sláðu inn ADMIN_KEY, sama lykil og er í Supabase Secrets. Hann er geymdur í þessum vafra.</p>
      <form id="gate">
        <input type="password" name="key" autocomplete="current-password" placeholder="ADMIN_KEY" required>
        ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
        <button class="btn primary" type="submit">Opna</button>
      </form>
    </section>`;
  app.querySelector('#gate').addEventListener('submit', (e) => {
    e.preventDefault();
    const k = String(new FormData(e.target).get('key')).trim().replace(/^["']|["']$/g, '');
    set(KEY, k);
    load(k);
  });
}

async function fetchFamily(f, key) {
  try {
    const res = await fetch(`${f.url}/functions/v1/${f.fn || 'clever-api'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key, apikey: f.key },
      body: JSON.stringify({ action: 'stats' }),
    });
    if (res.status === 403) {
      const reason = (await res.json().catch(() => ({}))).reason;
      const problem = {
        not_set: 'ADMIN_KEY er ekki til í þessu verkefni. Bættu því við: Edge Functions → Secrets → Name: ADMIN_KEY.',
        too_short: 'ADMIN_KEY í þessu verkefni er of stuttur. Hann þarf að vera a.m.k. 12 stafir.',
        mismatch: 'Lykillinn sem þú slóst inn er ekki sá sami og ADMIN_KEY í þessu verkefni.',
      }[reason] || 'Aðgangi hafnað. Er nýjasti clever-api kóðinn kominn inn (Deploy)?';
      return { ...f, problem, forbidden: reason === 'mismatch' };
    }
    if (res.status === 404) return { ...f, problem: `Fallið „${f.fn || 'clever-api'}“ fannst ekki í þessu verkefni.` };
    if (res.status === 401) return { ...f, problem: 'Þjónninn er af eldri gerð. Límdu nýja clever-api kóðann inn og Deploy.' };
    if (!res.ok) return { ...f, problem: `Villa frá þjóninum (${res.status}).` };
    const data = await res.json();
    if (!Array.isArray(data.weeks)) return { ...f, problem: 'Þjónninn er af eldri gerð. Límdu nýja clever-api kóðann inn og Deploy.' };
    return { ...f, data };
  } catch {
    // Gamall þjónn hafnar x-admin-key í CORS-forathugun, svo vafrinn fær enga svörun
    return { ...f, problem: 'Fékk ekkert svar. Líklegast er gamli clever-api kóðinn enn inni: límdu nýja kóðann inn og ýttu á Deploy. (Eða verkefnið er í dvala.)' };
  }
}

async function load(key) {
  app.innerHTML = '<p class="sub">Sæki tölur frá öllum fjölskyldum…</p>';
  const results = await Promise.all(families.map((f) => fetchFamily(f, key)));
  if (results.length && results.every((r) => r.forbidden)) {
    set(KEY, null);
    return renderGate('Lykillinn passaði ekki við neina fjölskyldu.');
  }
  render(results, key);
}

function render(results, key) {
  const ok = results.filter((r) => r.data);
  const weeksOf = (r) => r.data.weeks;
  // Síðasta heila vika = næstsíðasta línan; sú síðasta er vikan sem er í gangi
  const lastFull = (r) => weeksOf(r)[weeksOf(r).length - 2];
  const current = (r) => weeksOf(r)[weeksOf(r).length - 1];
  const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);

  const people = sum(ok, (r) => r.data.size.total);
  const kids = sum(ok, (r) => r.data.size.kids);
  const activeFam = ok.filter((r) => lastFull(r).activePeople > 0).length;
  const activePeople = sum(ok, (r) => lastFull(r).activePeople);
  const activeKids = sum(ok, (r) => lastFull(r).activeKids);
  const avgDays = ok.length ? (sum(ok, (r) => lastFull(r).activeDays) / ok.length) : 0;
  const weekLabel = ok.length ? ddmm(lastFull(ok[0]).week) : '';
  const nowWeek = sum(ok, (r) => current(r).activePeople);

  app.innerHTML = `
    <div class="head">
      <div><h1>Tölfræði</h1>
        <p class="sub">${families.length} fjölskyldur · uppfært kl. ${new Date().toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit', hour12: false })}</p></div>
      <div><button class="btn" id="reload">Uppfæra</button> <button class="link" id="forget">Gleyma lykli</button></div>
    </div>

    ${ok.length ? `
    <p class="sub" style="margin:0 0 8px">Síðasta heila vika (frá ${esc(weekLabel)})</p>
    <section class="tiles">
      ${tile('Virkar fjölskyldur', activeFam, ok.length, 'gerðu eitthvað í vikunni')}
      ${tile('Virkir notendur', activePeople, people, `${nowWeek} það sem af er þessari viku`)}
      ${tile('Virk börn', activeKids, kids, 'opna appið og gera sjálf')}
      ${tile('Dagar með virkni', avgDays.toFixed(1).replace('.', ','), 7, 'meðaltal á fjölskyldu')}
    </section>

    <section class="card">
      <h2>Virkir notendur á viku</h2>
      ${chart(ok)}
    </section>` : ''}

    ${results.map((r) => familyCard(r)).join('')}

    <p class="foot">Talið er það sem fólk <em>gerir</em> í appinu (verk, innkaup, myndir, hrós, áminningar, skilaboð, matseðill, óskir, story). Hvenær appið er bara opnað er ekki skráð. Engin nöfn eða innihald fara á milli: „Foreldri 1“ og „Barn 2“ eru í sömu röð og í appinu.</p>`;

  app.querySelector('#reload').addEventListener('click', () => load(key));
  app.querySelector('#forget').addEventListener('click', () => { set(KEY, null); renderGate(); });
  bindChart();
}

function tile(label, value, of, note) {
  return `<div class="tile"><div class="label">${esc(label)}</div>
    <div class="value">${esc(value)}${of != null ? ` <small>af ${esc(of)}</small>` : ''}</div>
    <div class="note">${esc(note)}</div></div>`;
}

function familyCard(r) {
  const head = `<div class="fam-head"><span class="swatch" style="background:${r.color}"></span>
    <h2 style="margin:0">${esc(r.name)}</h2><span class="pill">${esc(r.code)}</span>
    ${r.data ? `<span class="pill">${r.data.size.parents} foreldrar · ${r.data.size.kids} börn</span>` : '<span class="pill bad">Engar tölur</span>'}</div>`;
  if (!r.data) return `<section class="card">${head}<p class="problem">${esc(r.problem)}</p></section>`;
  const w = r.data.weeks.slice(-4).reverse();
  const yes = (b) => (b ? '<span class="yes">Já</span>' : '<span class="no">Nei</span>');
  const row = (label, fn) => `<tr><td>${esc(label)}</td>${w.map((x) => `<td class="num">${fn(x)}</td>`).join('')}</tr>`;
  return `
    <section class="card">
      ${head}
      <div class="subhead">Hver og einn, síðustu 28 dagar</div>
      <div class="scroll"><table>
        <thead><tr><th>Manneskja</th><th>PIN valið</th><th>Tilkynningar</th><th class="num">Virkir dagar</th><th class="num">Aðgerðir</th><th>Síðast virk(ur)</th></tr></thead>
        <tbody>${r.data.members.map((m) => `<tr><td>${esc(m.label)}</td><td>${yes(m.pin)}</td><td>${yes(m.push)}</td>
          <td class="num">${m.activeDays28} af 28</td><td class="num">${m.actions28}</td><td>${esc(ago(m.lastActive))}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="subhead">Síðustu 4 vikur</div>
      <div class="scroll"><table>
        <thead><tr><th>Vika frá</th>${w.map((x, i) => `<th class="num">${esc(ddmm(x.week))}${i === 0 ? ' (í gangi)' : ''}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('Virkir (foreldrar / börn)', (x) => `${x.activeParents} / ${x.activeKids}`)}
          ${row('Dagar með virkni', (x) => `${x.activeDays} af 7`)}
          ${row('Verk (þar af börn)', (x) => `${x.chores} (${x.choresByKids})`)}
          ${row('Vörur á lista / keyptar', (x) => `${x.shopAdded} / ${x.shopBought}`)}
          ${row('Dagar með mynd dagsins', (x) => x.photoDays)}
          ${row('Story', (x) => x.stories)}
          ${row('Hrós', (x) => x.kudos)}
          ${row('Áminningar nýjar / lokið', (x) => `${x.remindersNew} / ${x.remindersDone}`)}
          ${row('Skilaboð frá foreldrum', (x) => x.messages)}
          ${row('Matseðill (dagar)', (x) => x.meals)}
        </tbody>
      </table></div>
    </section>`;
}

// ------------------------------------------------------------------
// Línurit: virkir notendur á viku, ein lína á fjölskyldu
// ------------------------------------------------------------------
let chartData = null;

function chart(ok) {
  const weeks = ok[0].data.weeks.map((w) => w.week);
  const W = 960, H = 260, L = 36, R = 16, T = 12, B = 28;
  const max = Math.max(4, ...ok.flatMap((r) => r.data.weeks.map((w) => w.activePeople)));
  const top = Math.ceil(max / 2) * 2;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, weeks.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const step = top <= 6 ? 1 : 2;
  chartData = { ok, weeks, x, y, W, H, L, R, T, B };

  const grid = [];
  for (let v = 0; v <= top; v += step) {
    grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
  }
  const xl = weeks.map((wk, i) => (i % 2 === weeks.length % 2 || i === weeks.length - 1)
    ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(ddmm(wk))}</text>` : '').join('');
  const lines = ok.map((r) => {
    const pts = r.data.weeks.map((w, i) => `${x(i)},${y(w.activePeople)}`).join(' ');
    const last = r.data.weeks.length - 1;
    return `<polyline points="${pts}" fill="none" stroke="${r.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(last)}" cy="${y(r.data.weeks[last].activePeople)}" r="4" fill="${r.color}" stroke="var(--card)" stroke-width="2"/>`;
  }).join('');

  return `
    ${ok.length > 1 ? `<div class="legend">${ok.map((r) => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}
    <div class="chart-wrap">
      <svg id="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Virkir notendur á viku síðustu 12 vikur">
        ${grid.join('')}${xl}
        <line id="cross" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/>
        ${lines}
        <g id="dots"></g>
        <rect id="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
      </svg>
      <div class="tip" id="tip"></div>
    </div>
    <p class="sub" style="font-size:12.5px">Síðasti punkturinn er vikan sem er í gangi og hækkar fram á sunnudag.</p>`;
}

function bindChart() {
  const svg = document.getElementById('chart');
  if (!svg || !chartData) return;
  const { ok, weeks, x, y, W } = chartData;
  const tip = document.getElementById('tip');
  const cross = svg.querySelector('#cross');
  const dots = svg.querySelector('#dots');
  const hide = () => { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; };
  const show = (clientX) => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    let i = 0, best = Infinity;
    weeks.forEach((_, k) => { const d = Math.abs(x(k) - px); if (d < best) { best = d; i = k; } });
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    dots.innerHTML = ok.map((r) => `<circle cx="${x(i)}" cy="${y(r.data.weeks[i].activePeople)}" r="4.5" fill="${r.color}" stroke="var(--card)" stroke-width="2"/>`).join('');
    tip.innerHTML = `<b>Vika frá ${esc(ddmm(weeks[i]))}${i === weeks.length - 1 ? ' (í gangi)' : ''}</b>` + ok
      .map((r) => ({ r, w: r.data.weeks[i] }))
      .sort((a, b) => b.w.activePeople - a.w.activePeople)
      .map(({ r, w }) => `<div><span><i style="background:${r.color}"></i>${esc(r.name)}</span><span>${w.activePeople} af ${r.data.size.total}</span></div>`).join('');
    tip.style.display = 'block';
    const wrap = svg.parentElement.getBoundingClientRect();
    const left = (x(i) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(0, left + 12), wrap.width - tip.offsetWidth)}px`;
    tip.style.top = '8px';
  };
  const hit = svg.querySelector('#hit');
  hit.addEventListener('pointermove', (e) => show(e.clientX));
  hit.addEventListener('pointerdown', (e) => show(e.clientX));
  hit.addEventListener('pointerleave', hide);
}
