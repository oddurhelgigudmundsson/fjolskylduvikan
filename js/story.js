// Story: myndir sem lifa í 24 klukkutíma, eins og á Instagram, bara fyrir fjölskylduna.
// - Hringir efst á forsíðunni; litaður hringur = eitthvað sem þú hefur ekki séð (geymt í símanum).
// - Ýtt á hring → fullur skjár. Hægri = næsta, vinstri = fyrri, haldið niðri = stoppa, strokið niður = loka.
// - Engin tilkynning, ekkert „séð af“. Viðbrögð með emoji eins og á Mynd dagsins.
import { icon } from './icons.js';
import { esc, firstName } from './util.js';

const SEEN_KEY = 'fv.storyseen';
const DURATION = 5000;                 // ms fyrir hverja mynd
const MAX_PICK = 10;
const REACTIONS = ['❤️', '😂', '😍', '👏', '🔥'];

let ctx = null;                        // { state, store, backend, avatar, profileById, isParent, toast, openSheet, shrinkPhoto, renderView }
let player = null;                     // opinn skoðari, ef einhver

export function initStories(c) { ctx = c; }

// ------------------------------------------------------------------
// Gögn
// ------------------------------------------------------------------
export async function loadStories() {
  const { state, backend } = ctx;
  try {
    const stories = await backend.listStories();
    const [reactions, urls] = await Promise.all([
      backend.listStoryReactions(stories.map((s) => s.id)),
      backend.photoUrls(stories.map((s) => s.path).filter((p) => !state.photoUrls[p])),
    ]);
    state.stories = stories;
    state.storyReactions = reactions || [];
    Object.assign(state.photoUrls, urls);
  } catch (e) {
    console.error(e);
    state.stories = state.stories || [];
  }
  player?.refresh();
}

const live = () => {
  const now = new Date().toISOString();
  return (ctx.state.stories || []).filter((s) => s.expires_at > now);
};

function seen() {
  try { return new Set(JSON.parse(ctx.store.get(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function markSeen(id) {
  const s = seen();
  if (s.has(id)) return;
  s.add(id);
  const ids = new Set(live().map((x) => x.id));
  ctx.store.set(SEEN_KEY, JSON.stringify([...s].filter((x) => ids.has(x))));
}

// Ég fyrst, svo þeir sem eiga óséð, svo hinir; nýjast fyrst innan hvers
function groups() {
  const { state } = ctx;
  const s = seen();
  const byPerson = new Map();
  for (const st of live()) (byPerson.get(st.profile_id) || byPerson.set(st.profile_id, []).get(st.profile_id)).push(st);
  const list = [...byPerson.entries()]
    .map(([id, stories]) => ({ profile: ctx.profileById(id), stories, unseen: stories.some((x) => !s.has(x.id)), last: stories[stories.length - 1].created_at }))
    .filter((g) => g.profile);
  const mine = list.find((g) => g.profile.id === state.me.id);
  const others = list.filter((g) => g.profile.id !== state.me.id)
    .sort((a, b) => (b.unseen - a.unseen) || b.last.localeCompare(a.last));
  return { mine, others, playable: [...(mine ? [mine] : []), ...others] };
}

// ------------------------------------------------------------------
// Hringirnir á forsíðunni
// ------------------------------------------------------------------
export function storiesBar() {
  const { state, avatar } = ctx;
  const { mine, others } = groups();
  const ring = (g, label) => `
    <div class="story-item">
      <button class="story-ring ${g.unseen ? 'unseen' : 'seen'}" style="--c:${esc(g.profile.color)}" data-story-open="${esc(g.profile.id)}" aria-label="Story frá ${esc(g.profile.name)}">
        ${avatar(g.profile, 'lg')}</button>
      <span class="story-name">${esc(label)}</span>
    </div>`;
  return `
    <section class="story-bar" aria-label="Story">
      <div class="story-item">
        ${mine
          ? `<button class="story-ring ${mine.unseen ? 'unseen' : 'seen'}" style="--c:${esc(state.me.color)}" data-story-open="${esc(state.me.id)}" aria-label="Story-ið mitt">${avatar(state.me, 'lg')}</button>`
          : `<button class="story-ring empty" data-story-add aria-label="Setja inn story">${avatar(state.me, 'lg')}</button>`}
        <button class="story-plus" data-story-add aria-label="Setja inn story">${icon('plus')}</button>
        <span class="story-name">Þú</span>
      </div>
      ${others.map((g) => ring(g, firstName(g.profile.name))).join('')}
    </section>`;
}

export function bindStories(root) {
  root.querySelectorAll('[data-story-open]').forEach((b) => b.addEventListener('click', () => openViewer(b.dataset.storyOpen)));
  root.querySelectorAll('[data-story-add]').forEach((b) => b.addEventListener('click', openAdd));
}

// ------------------------------------------------------------------
// Setja inn: taka mynd eða velja eina eða fleiri (nýjar eða gamlar)
// ------------------------------------------------------------------
function openAdd() {
  const s = ctx.openSheet(`
    <h2>Story</h2>
    <p class="muted">Allir í fjölskyldunni sjá myndirnar í 24 klukkutíma, svo hverfa þær. Mega vera nýjar eða gamlar.</p>
    <label class="btn primary big file-btn">${icon('camera')} Taka mynd<input type="file" accept="image/*" capture="environment" id="story-camera" hidden></label>
    <label class="btn big file-btn">${icon('images')} Velja úr myndasafni<input type="file" accept="image/*" multiple id="story-library" hidden></label>
    <button class="btn" data-close>Hætta við</button>`);
  const pick = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    if (!files.length) return;
    if (files.length > MAX_PICK) ctx.toast(`Mest ${MAX_PICK} myndir í einu — fyrstu ${MAX_PICK} eru teknar`);
    s.close();
    setTimeout(() => openConfirm(files.slice(0, MAX_PICK)), 230);
  };
  s.el.querySelector('#story-camera').addEventListener('change', pick);
  s.el.querySelector('#story-library').addEventListener('change', pick);
}

function openConfirm(files) {
  const urls = files.map((f) => URL.createObjectURL(f));
  const n = files.length;
  const s = ctx.openSheet(`
    <h2>${n === 1 ? 'Setja í story?' : `${n} myndir í story`}</h2>
    <div class="story-picks ${n === 1 ? 'one' : ''}">${urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>
    <div class="sheet-actions">
      <button class="btn primary big" id="story-send">Setja í story</button>
      <button class="btn" data-close>Hætta við</button>
    </div>`);
  const btn = s.el.querySelector('#story-send');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let done = 0;
    try {
      for (const f of files) {
        btn.textContent = n === 1 ? 'Sendi…' : `Sendi ${done + 1} af ${n}…`;
        const blob = await ctx.shrinkPhoto(f);
        await ctx.backend.addStory({ profile_id: ctx.state.me.id, blob });
        done++;
      }
      urls.forEach((u) => URL.revokeObjectURL(u));
      s.close();
      await loadStories();
      ctx.renderView();
      ctx.toast(n === 1 ? 'Komið í story' : `${n} myndir komnar í story`);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      btn.textContent = 'Reyna aftur';
      if (done) { await loadStories(); ctx.renderView(); }
      ctx.toast(done ? `${done} af ${n} fóru inn — reyndu aftur með restina` : 'Gat ekki sent — er búið að keyra 8-story.sql?');
      files.splice(0, done);
    }
  });
}

// ------------------------------------------------------------------
// Skoðari á fullum skjá
// ------------------------------------------------------------------
function timeAgo(isoStr) {
  const min = Math.max(0, Math.round((Date.now() - new Date(isoStr)) / 60000));
  if (min < 1) return 'rétt í þessu';
  if (min < 60) return `fyrir ${min} mín`;
  return `fyrir ${Math.floor(min / 60)} klst`;
}

function openViewer(profileId) {
  const { playable } = groups();
  let gi = playable.findIndex((g) => g.profile.id === profileId);
  if (gi < 0) return;
  // Byrja á fyrstu óséðu myndinni hjá viðkomandi, annars þeirri fyrstu
  const sn = seen();
  let si = Math.max(0, playable[gi].stories.findIndex((x) => !sn.has(x.id)));
  const queue = playable.map((g) => ({ profile: g.profile, stories: [...g.stories] }));

  const el = document.createElement('div');
  el.className = 'story-viewer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  document.body.append(el);
  document.body.classList.add('no-scroll');

  let elapsed = 0, last = 0, raf = 0, paused = false, loading = true, held = false, confirmDel = false;
  const cur = () => queue[gi]?.stories[si];

  function render() {
    const g = queue[gi], st = cur();
    if (!g || !st) return close();
    markSeen(st.id);
    const mine = g.profile.id === ctx.state.me.id;
    el.innerHTML = `
      <div class="sv-stage">
        <img class="sv-img" src="${esc(ctx.state.photoUrls[st.path] || '')}" alt="">
        <div class="sv-top">
          <div class="sv-bars">${g.stories.map((_, i) => `<span class="sv-bar"><i style="width:${i < si ? 100 : 0}%"></i></span>`).join('')}</div>
          <div class="sv-head">${ctx.avatar(g.profile, 'sm')}
            <strong>${esc(firstName(g.profile.name))}</strong><span class="sv-ago">${esc(timeAgo(st.created_at))}</span>
            <button class="sv-close" aria-label="Loka">${icon('x')}</button></div>
        </div>
        <div class="sv-tap" aria-hidden="true"></div>
      </div>
      <div class="sv-foot">${foot(st, mine)}</div>`;
    loading = true;
    elapsed = 0;
    const img = el.querySelector('.sv-img');
    const ready = () => { loading = false; last = performance.now(); };
    if (img.complete && img.naturalWidth) ready(); else { img.onload = ready; img.onerror = ready; }
    preload();
    bind(st);
  }

  function foot(st, mine) {
    const rs = ctx.state.storyReactions.filter((r) => r.story_id === st.id);
    const myR = rs.find((r) => r.profile_id === ctx.state.me.id)?.emoji;
    const who = rs.map((r) => `${r.emoji} ${esc(firstName(ctx.profileById(r.profile_id)?.name || ''))}`).join(' · ');
    // Hver eyðir sinni; foreldrar geta líka tekið út story barns
    const canDelete = mine || (ctx.isParent() && ctx.profileById(st.profile_id)?.role === 'child');
    return `
      ${mine ? '' : `<div class="sv-react">${REACTIONS.map((e) => `<button class="${myR === e ? 'on' : ''}" data-sv-react="${e}">${e}</button>`).join('')}</div>`}
      ${who ? `<p class="sv-who">${who}</p>` : (mine ? '<p class="sv-who">Engin viðbrögð ennþá</p>' : '')}
      ${canDelete ? `<button class="sv-del ${confirmDel ? 'confirm' : ''}" data-sv-del>${icon('trash-2')} ${confirmDel ? 'Ýttu aftur til að eyða' : 'Eyða úr story'}</button>` : ''}`;
  }

  function refreshFoot() {
    const st = cur();
    if (!st) return;
    el.querySelector('.sv-foot').innerHTML = foot(st, queue[gi].profile.id === ctx.state.me.id);
    bindFoot(st);
  }

  function preload() {
    const nxt = queue[gi].stories[si + 1] || queue[gi + 1]?.stories[0];
    if (nxt && ctx.state.photoUrls[nxt.path]) { const i = new Image(); i.src = ctx.state.photoUrls[nxt.path]; }
  }

  function tick(t) {
    raf = requestAnimationFrame(tick);
    if (paused || held || loading || document.visibilityState !== 'visible') { last = t; return; }
    elapsed += t - last; last = t;
    const bar = el.querySelectorAll('.sv-bar i')[si];
    if (bar) bar.style.width = Math.min(100, (elapsed / DURATION) * 100) + '%';
    if (elapsed >= DURATION) next();
  }

  function next() {
    confirmDel = false; paused = false;
    if (si < queue[gi].stories.length - 1) si++;
    else if (gi < queue.length - 1) { gi++; si = 0; }
    else return close();
    render();
  }
  function prev() {
    confirmDel = false; paused = false;
    if (si > 0) si--;
    else if (gi > 0) { gi--; si = queue[gi].stories.length - 1; }
    render();
  }

  function close() {
    cancelAnimationFrame(raf);
    el.classList.add('closing');
    document.body.classList.remove('no-scroll');
    setTimeout(() => el.remove(), 180);
    player = null;
    ctx.renderView();
  }

  function bind(st) {
    el.querySelector('.sv-close').addEventListener('click', close);
    const tap = el.querySelector('.sv-tap');
    let downAt = 0, x0 = 0, y0 = 0, holdTimer = 0, dy = 0;
    tap.addEventListener('pointerdown', (e) => {
      downAt = performance.now(); x0 = e.clientX; y0 = e.clientY; dy = 0;
      holdTimer = setTimeout(() => { held = true; el.classList.add('held'); }, 180);
      tap.setPointerCapture?.(e.pointerId);
    });
    tap.addEventListener('pointermove', (e) => {
      if (!downAt) return;
      dy = Math.max(0, e.clientY - y0);
      if (dy > 8) el.querySelector('.sv-stage').style.transform = `translateY(${dy}px)`;
    });
    const up = (e) => {
      if (!downAt) return;
      clearTimeout(holdTimer);
      const long = performance.now() - downAt > 250;
      downAt = 0;
      const wasHeld = held;
      held = false; el.classList.remove('held');
      el.querySelector('.sv-stage').style.transform = '';
      if (dy > 90) return close();
      if (wasHeld && long) return;                     // haldið niðri → bara stoppað
      if (Math.abs(e.clientY - y0) > 30) return;
      const w = tap.getBoundingClientRect();
      if (e.clientX - w.left < w.width / 3) prev(); else next();
    };
    tap.addEventListener('pointerup', up);
    tap.addEventListener('pointercancel', () => { clearTimeout(holdTimer); downAt = 0; held = false; el.classList.remove('held'); el.querySelector('.sv-stage').style.transform = ''; });
    bindFoot(st);
  }

  function bindFoot(st) {
    el.querySelectorAll('[data-sv-react]').forEach((b) => b.addEventListener('click', async () => {
      const mineR = ctx.state.storyReactions.find((r) => r.story_id === st.id && r.profile_id === ctx.state.me.id)?.emoji;
      const emoji = b.dataset.svReact === mineR ? null : b.dataset.svReact;
      // Strax á skjáinn, svo vistað
      ctx.state.storyReactions = ctx.state.storyReactions.filter((r) => !(r.story_id === st.id && r.profile_id === ctx.state.me.id));
      if (emoji) ctx.state.storyReactions.push({ story_id: st.id, profile_id: ctx.state.me.id, emoji });
      refreshFoot();
      try { await ctx.backend.reactStory(st.id, ctx.state.me.id, emoji); } catch { ctx.toast('Gat ekki vistað'); }
    }));
    el.querySelector('[data-sv-del]')?.addEventListener('click', async () => {
      if (!confirmDel) { confirmDel = true; paused = true; refreshFoot(); return; }
      try {
        await ctx.backend.deleteStory(st);
        ctx.state.stories = ctx.state.stories.filter((x) => x.id !== st.id);
        const g = queue[gi];
        g.stories.splice(si, 1);
        confirmDel = false; paused = false;
        ctx.toast('Eytt úr story');
        if (!g.stories.length) { queue.splice(gi, 1); si = 0; if (gi >= queue.length) return close(); }
        else if (si >= g.stories.length) { si = 0; gi++; if (gi >= queue.length) return close(); }
        render();
      } catch { ctx.toast('Gat ekki eytt'); }
    });
  }

  const onKey = (e) => {
    if (!document.body.contains(el)) return document.removeEventListener('keydown', onKey);
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };
  document.addEventListener('keydown', onKey);

  player = {
    // Ný gögn bárust (viðbrögð eða ný mynd): uppfæra neðri hlutann án þess að trufla
    refresh() { refreshFoot(); },
  };
  render();
  requestAnimationFrame((t) => { last = t; raf = requestAnimationFrame(tick); el.classList.add('open'); });
}
