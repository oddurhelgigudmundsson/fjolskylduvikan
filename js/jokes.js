// Brandari dagsins — fjölskylduvænir brandarar og gátur.
// q = spurning / brandarinn, a = svarið (ef það er spurning).
// Allir í fjölskyldunni fá sama brandara sama daginn.

export const JOKES = [
  { q: 'Hvað sagði núllið við áttuna?', a: 'Flott belti!' },
  { q: 'Hvað kallarðu bangsa sem er ekki með neinar tennur?', a: 'Gúmmíbangsa.' },
  { q: 'Ég er hættur að borða klukkur.', a: 'Það var allt of tímafrekt.' },
  { q: 'Ég er að lesa bók um þyngdarafl.', a: 'Ég get bara ekki lagt hana frá mér.' },
  { q: 'Hvað kallarðu risaeðlu sem steinsefur?', a: 'Hrotueðlu.' },
  { q: 'Af hverju var stærðfræðibókin svona leið?', a: 'Hún átti við svo mörg vandamál að stríða.' },
  { q: 'Hvað sagði annar snjókarlinn við hinn?', a: 'Finnurðu líka gulrótarlykt?' },
  { q: 'Hvernig sérðu að fíll hefur verið í ísskápnum?', a: 'Það eru fótspor í smjörinu.' },
  { q: 'Hvað er rautt og fer upp og niður?', a: 'Tómatur í lyftu.' },
  { q: 'Hvað kallarðu hund sem kann að galdra?', a: 'Labrakadabrador.' },
  { q: 'Af hverju eru draugar svona lélegir að ljúga?', a: 'Það sést alveg í gegnum þá.' },
  { q: 'Hvað hefur háls en ekkert höfuð?', a: 'Flaska.' },
  { q: 'Hvað hefur tennur en bítur aldrei?', a: 'Greiða.' },
  { q: 'Hvað verður blautara því meira sem það þurrkar?', a: 'Handklæði.' },
  { q: 'Hvað hefur marga lykla en getur ekki opnað eina einustu hurð?', a: 'Píanó.' },
  { q: 'Hvað getur ferðast um allan heiminn en er samt alltaf úti í horni?', a: 'Frímerki.' },
  { q: 'Hvaða mánuðir hafa 28 daga?', a: 'Allir!' },
  { q: 'Hvað er hægt að brjóta án þess að snerta það?', a: 'Loforð.' },
  { q: 'Hvað fer upp en kemur aldrei niður aftur?', a: 'Aldurinn.' },
  { q: 'Hvað átt þú sem aðrir nota miklu meira en þú sjálf/ur?', a: 'Nafnið þitt.' },
  { q: 'Hvaða dýr geta hoppað hærra en hús?', a: 'Öll dýr. Hús geta ekki hoppað.' },
  { q: 'Hvað færðu ef þú blandar saman kú og trampólíni?', a: 'Mjólkurhristing.' },
  { q: 'Hvað kallarðu snjókarl í júlí?', a: 'Poll.' },
  { q: 'Hvað segir maður við kanínu á afmælisdaginn?', a: 'Til hoppamingju!' },
  { q: 'Hvað er svart, hvítt og rautt?', a: 'Mörgæs sem roðnar.' },
  { q: 'Af hverju fór kjúklingurinn í strætó?', a: 'Hann nennti ekki að labba yfir götuna.' },
  { q: 'Hvernig kemst fíll upp í tré?', a: 'Hann sest á fræ og bíður.' },
  { q: 'Hvað gerir tölvan þegar hún er svöng?', a: 'Fær sér nokkrar vafrakökur.' },
  { q: 'Af hverju roðnaði tómaturinn?', a: 'Hann sá salatið bera.' },
  { q: 'Hvað segir mamman þegar kýrin fer út?', a: 'Múúúnaðu eftir húfunni!' },
  { q: 'Hvaða tónlist hlusta fjöllin á?', a: 'Grjótharða rokktónlist.' },
  { q: 'Af hverju setja kennarar upp sólgleraugu í skólanum?', a: 'Nemendurnir eru svo bjartir.' },
  { q: '„Læknir, læknir, ég held að ég sé gardína!“', a: '„Svona, svona. Dragðu þig nú saman.“' },
  { q: '„Læknir, læknir, ég held að ég sé spilastokkur!“', a: '„Sestu niður, ég gef mér tíma fyrir þig á eftir.“' },
  { q: 'Kennarinn: „Nefndu tvö fornöfn.“', a: 'Nemandinn: „Hver, ég?“ Kennarinn: „Hárrétt!“' },
  { q: '„Pabbi, ég er svangur.“', a: '„Hæ Svangur, ég er pabbi.“' },
  { q: 'Ég sagði konunni minni að hún hefði teiknað augabrúnirnar of hátt.', a: 'Hún varð mjög hissa.' },
  { q: 'Kennarinn: „Nonni, ef þú átt 100 krónur og biður pabba þinn um 100 í viðbót, hvað áttu þá mikið?“', a: 'Nonni: „100 krónur.“ Kennarinn: „Þú kannt ekki að reikna!“ Nonni: „Þú þekkir ekki pabba minn!“' },
  { q: '„Mamma, krakkarnir í skólanum segja að ég sé með stórt höfuð!“ „Ekki hlusta á þá. Skrepptu frekar út í búð og keyptu tíu kíló af kartöflum.“ „Hvar er pokinn?“', a: '„Notaðu bara húfuna þína.“' },
  { q: 'Hafnfirðingur hringdi á flugvöllinn: „Hvað tekur langan tíma að fljúga til London?“ Konan svaraði: „Augnablik…“', a: '„Takk kærlega!“ sagði Hafnfirðingurinn og skellti á.' },
  { q: 'Af hverju geymir Hafnfirðingurinn tóma mjólkurfernu í ísskápnum?', a: 'Fyrir þá sem vilja ekki mjólk.' },
  { q: 'Af hverju fór Hafnfirðingurinn með reglustiku upp í rúm?', a: 'Hann vildi sjá hvað hann svæfi lengi.' },
  { q: 'Af hverju setti Hafnfirðingurinn klukkuna sína inn í bankann?', a: 'Hann vildi spara tíma.' },
  { q: 'Hafnfirðingurinn keypti sér vasaljós sem gengur fyrir sólarorku.', a: 'Nú virkar það bara á daginn.' },
  { q: 'Hvernig er íslenskt sumar?', a: 'Besti dagur ársins.' },
  { q: 'Ef þér líkar ekki veðrið á Íslandi…', a: '…bíddu bara í fimm mínútur.' },
  { q: 'Hvað sagði eitt fjall við hitt fjallið?', a: 'Hittumst í dalnum.' },
  { q: 'Af hverju fara beinagrindur aldrei á ball?', a: 'Þær hafa ekki hjarta í það.' },
  { q: 'Af hverju kann ruslið ekki að dansa?', a: 'Það er alltaf úti.' },
  { q: 'Hvað sagði uppþvottavélin við diskana?', a: 'Ég skal taka ykkur í gegn.' },
  { q: 'Af hverju er rúmið alltaf svona þreytt?', a: 'Það er búið um það á hverjum degi.' },
  { q: 'Af hverju eru sokkar alltaf einir?', a: 'Hinn er alltaf farinn í ferðalag með þvottavélinni.' },
  { q: 'Hvað er gult og hættulegt?', a: 'Hákarl í gulum regnjakka.' },
  { q: 'Af hverju hljóp Hafnfirðingurinn í kringum rúmið sitt?', a: 'Hann var að reyna að ná svefninum.' },
];

// Sami brandari fyrir alla sama daginn (raðast eftir dögum)
export function jokeOfTheDay(date = new Date()) {
  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const n = JOKES.length;
  // Hrærum röðinni svo líkir brandarar komi ekki dag eftir dag;
  // skrefið deilir ekki n svo allir brandararnir koma áður en hringurinn byrjar aftur.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let step = 37;
  while (gcd(step, n) !== 1) step++;
  return JOKES[(((day * step) % n) + n) % n];
}
