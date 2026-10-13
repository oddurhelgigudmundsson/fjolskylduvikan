// Fjölskyldurnar sem nota appið.
// Hver fjölskylda hefur sitt eigið Supabase-verkefni (sín eigin gögn).
// Kóðinn (t.d. 'prufa1') er það sem fjölskyldan slær inn, eða fær í slóðinni:
//   https://oddurhelgigudmundsson.github.io/fjolskylduvikan/?f=prufa1
//
//   name – nafnið sem birtist á innskráningarskjánum
//   url  – "Project URL" úr Supabase (Project Settings → API)
//   key  – "publishable / anon key" úr Supabase. Hann má vera opinber: gögnin
//          eru varin með innskráningu og öryggisreglum í gagnagrunninum.
//          ALDREI setja "secret" eða "service_role" lykil hér.
//   fn   – nafnið á fallinu í Supabase → Edge Functions
//
// Ef listinn er tómur keyrir appið í prufuham: gögn vistast bara í tækinu.

export const FAMILIES = {
  okatp: {
    name: 'Fjölskylduvikan',
    url: 'https://kuqxnwxcocxecxxwczqm.supabase.co',
    key: 'sb_publishable__isNdG954mu5XoGnxdifiw_jta0WfpD',
    fn: 'clever-api',
  },
  // prufa1: {
  //   name: 'Fjölskyldan',
  //   url: 'https://XXXXXXXX.supabase.co',
  //   key: 'sb_publishable_XXXXXXXX',
  //   fn: 'clever-api',
  // },
};

// Símar sem voru settir upp áður en fleiri fjölskyldur bættust við tilheyra þessari.
export const DEFAULT_FAMILY = 'okatp';
