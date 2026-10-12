// Hjálparföll: dagsetningar á íslensku, flokkun vara, öryggi.

export const DAYS = ['Sunnudagur', 'Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur'];
export const DAYS_SHORT = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau'];
export const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function startOfWeek(d) {
  const x = new Date(d); x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // mánudagur
  return x;
}

export function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}

export const longDate = (d) => `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;

export function weekRange(monday) {
  const sun = addDays(monday, 6);
  if (monday.getMonth() === sun.getMonth()) return `${monday.getDate()}.–${sun.getDate()}. ${MONTHS[sun.getMonth()]}`;
  return `${monday.getDate()}. ${MONTHS[monday.getMonth()]} – ${sun.getDate()}. ${MONTHS[sun.getMonth()]}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function hashPin(profileId, pin) {
  const bytes = new TextEncoder().encode(`fjolskylduvikan:${profileId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const firstName = (name) => String(name).split(' ')[0];

// ------------------------------------------------------------------
// Flokkun vara eftir búðinni. Í íslenskum samsettum orðum ræður
// síðasti hlutinn ("appelsínusafi" er drykkur, "rjómaostur" er ostur),
// svo það lykilorð sem kemur SÍÐAST í heitinu vinnur.
// ------------------------------------------------------------------
export const CATEGORIES = [
  'Ávextir og grænmeti',
  'Brauð og bakkelsi',
  'Kjöt og fiskur',
  'Mjólkurvörur og egg',
  'Þurrvörur',
  'Frystivörur',
  'Drykkir',
  'Snarl og sælgæti',
  'Hreinlæti og heimili',
  'Annað',
];

const KEYWORDS = {
  'Ávextir og grænmeti': ['epli', 'banan', 'appelsín', 'pera', 'perur', 'vínber', 'jarðarber', 'bláber', 'hindber', 'sítrón', 'lime', 'avókadó', 'avocado', 'tómat', 'gúrk', 'agúrk', 'salat', 'kál', 'spínat', 'papr', 'lauk', 'hvítlauk', 'kartöfl', 'gulrót', 'gulræt', 'svepp', 'brokkol', 'blómkál', 'maís', 'engifer', 'kóríander', 'steinselj', 'ávext', 'grænmet', 'mangó', 'melón', 'kíví', 'kiwi', 'klementín', 'mandarín', 'rófa', 'rófur', 'sætkartöfl', 'kúrbít', 'chili'],
  'Brauð og bakkelsi': ['brauð', 'rúnstykk', 'beygl', 'tortill', 'vefj', 'flatkök', 'kex', 'kaka', 'kökur', 'snúð', 'pítu', 'pizzabotn', 'croissant', 'kanilsnúð', 'hrökkbrauð'],
  'Kjöt og fiskur': ['kjúkling', 'kjöt', 'hakk', 'naut', 'lamb', 'svín', 'beikon', 'skink', 'pyls', 'fisk', 'ýsa', 'ýsu', 'lax', 'þorsk', 'rækj', 'túnfisk', 'bleikj', 'hamborgar', 'álegg', 'pepperoni', 'bringur', 'læri', 'kótelett', 'kalkún', 'salami'],
  'Mjólkurvörur og egg': ['mjólk', 'skyr', 'jógúrt', 'ostur', 'osti', 'osta', 'smjör', 'rjóm', 'súrmjólk', 'sýrður', 'mozzarella', 'parmesan', 'feta', 'kotasæl', 'grísk', 'hafrajógúrt', 'smurost'],
  'Þurrvörur': ['pasta', 'spagettí', 'spaghetti', 'lasagnaplöt', 'grjón', 'hveiti', 'sykur', 'salt', 'pipar', 'krydd', 'haframjöl', 'morgunkorn', 'cheerios', 'kornflex', 'cornflakes', 'olía', 'olíu', 'edik', 'sinnep', 'majónes', 'sósa', 'sósu', 'niðursoð', 'baunir', 'hnetusmjör', 'sulta', 'hunang', 'kaffi', 'kakó', 'núðl', 'tacoskel', 'salsa', 'súpa', 'súpu', 'lyftiduft', 'matarsódi', 'tepok', 'teninga', 'kraft', 'múslí', 'granóla', 'hafrar', 'rúsín', 'hnetur', 'möndl'],
  'Frystivörur': ['frosin', 'frosn', 'frysti', 'franskar', 'pizza ', 'fiskistauta', 'frostpinn'],
  'Drykkir': ['safi', 'safa', 'djús', 'gos', 'kók', 'pepsi', 'sódavatn', 'kristal', 'malt', 'appelsín og malt', 'bjór', 'vín ', 'orkudrykk', 'hafradrykk', 'vatnsflösk'],
  'Snarl og sælgæti': ['nammi', 'súkkulað', 'snakk', 'popp', 'flögur', 'lakkrís', 'sælgæti', 'tyggjó', 'kexstang', 'hlaup', 'rís'],
  'Hreinlæti og heimili': ['klósett', 'wc', 'eldhúsrúll', 'sápa', 'sápu', 'sjampó', 'hárnær', 'tannkrem', 'tannbursta', 'uppþvott', 'þvottaefn', 'mýkingarefn', 'bleyj', 'ruslapok', 'svamp', 'álpappír', 'plastfilm', 'bökunarpapp', 'dömubind', 'túrtapp', 'rakvél', 'svitalyktareyð', 'plástr', 'batterí', 'rafhlöð', 'ljósaper', 'servíett', 'nestispok'],
};
const WHOLE_WORDS = { 'ís': 'Frystivörur', 'egg': 'Mjólkurvörur og egg', 'te': 'Þurrvörur', 'vatn': 'Drykkir', 'pizza': 'Frystivörur' };

export function categorize(name) {
  const s = ` ${String(name).toLowerCase().trim()} `;
  const words = s.trim().split(/[\s,.-]+/);
  for (const w of words) if (WHOLE_WORDS[w] && words.length === 1) return WHOLE_WORDS[w];

  let best = null, bestPos = -1, bestLen = 0;
  for (const [cat, keys] of Object.entries(KEYWORDS)) {
    for (const k of keys) {
      const pos = s.lastIndexOf(k);
      if (pos < 0) continue;
      const end = pos + k.length;
      // síðasta lykilorðið vinnur; ef jafnt, það lengsta
      if (end > bestPos + bestLen || (end === bestPos + bestLen && k.length > bestLen)) {
        best = cat; bestPos = pos; bestLen = k.length;
      }
    }
  }
  if (best) return best;
  for (const w of words) if (WHOLE_WORDS[w]) return WHOLE_WORDS[w];
  return 'Annað';
}
