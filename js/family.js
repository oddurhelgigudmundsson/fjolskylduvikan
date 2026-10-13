// Hvaða fjölskyldu tilheyrir þessi sími?
// 1) ?f=kóði í slóðinni  2) kóði sem var vistaður áður  3) eldri sími → aðalfjölskyldan
// Annars þarf að spyrja (skjár þar sem kóðinn er sleginn inn).
import { FAMILIES, DEFAULT_FAMILY } from './config.js';

const KEY = 'fv.family';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ekkert */ } };

const norm = (code) => String(code || '').trim().toLowerCase();
const lookup = (code) => (FAMILIES[norm(code)] ? { code: norm(code), ...FAMILIES[norm(code)] } : null);

export const familyCount = () => Object.keys(FAMILIES).length;

// Skilar { code, name, url, key, fn }, null (prufuhamur) eða 'ask'
export function resolveFamily() {
  const codes = Object.keys(FAMILIES);
  if (!codes.length) return null;

  const fromUrl = lookup(new URLSearchParams(location.search).get('f'));
  if (fromUrl) { set(KEY, fromUrl.code); return fromUrl; }

  const saved = lookup(get(KEY));
  if (saved) return saved;

  if (codes.length === 1) return lookup(codes[0]);

  // Sími sem var þegar innskráður áður en fjölskyldukóðar komu til
  if (FAMILIES[DEFAULT_FAMILY] && (get('fv.auth') || get('fv.me'))) {
    set(KEY, DEFAULT_FAMILY);
    return lookup(DEFAULT_FAMILY);
  }
  return 'ask';
}

// Vistar kóðann ef hann er til; skilar true/false
export function chooseFamily(code) {
  const f = lookup(code);
  if (!f) return false;
  set(KEY, f.code);
  return true;
}

export function forgetFamily() { set(KEY, null); }

// Innskráning hverrar fjölskyldu geymd sér, svo þær rekist aldrei á
export const authKey = (f) => (f.code === DEFAULT_FAMILY ? 'fv.auth' : `fv.auth.${f.code}`);
