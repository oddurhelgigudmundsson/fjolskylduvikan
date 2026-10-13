# Backlog — Fjölskylduvikan

Hugmyndir sem búið er að skoða en ekki útfæra. Nýjast efst.

---

## 1. Krónan: innkaupalistinn í Krónuna

*Skoðað 13. okt. 2026 · Staða: í bið*

**Hugmyndin:** Foreldri ýtir á „Senda í Krónu“ og innkaupalistinn fer yfir í Snjallverslun Krónunnar.

**Það sem er til**
- Krónan er með opinbert API, **Kronan Public API**, í beta: `https://api.kronan.is/api/v1/`.
- [kronan-mcp](https://github.com/sandsower/kronan-mcp) er óopinber MCP-þjónn ofan á sama API. Appið þarf hann **ekki** og getur kallað beint á API-ið úr `clever-api`. MCP-þjónninn nýtist ef maður vill biðja Claude (Desktop/Code) um að gera þetta handvirkt.
- API-ið leitar að vörum (`products/search`), bætir í körfu (`checkout/lines`, SKU + magn), skrifar á minnismiða (`shopping-notes/add-line`, frjáls texti eða SKU) og sýnir kaupsögu (`product-purchase-stats`).
- Það getur **ekki** greitt eða valið afhendingartíma (það er „coming soon“ hjá Krónunni).

**Tvær leiðir**
- **A. Minnismiði (byrja hér):** hver vara fer sem texti á minnismiða Krónunnar. Lítið verk og engin pörun.
- **B. Beint í körfu:** hver vara er pöruð við SKU. Pörunin notar kaupsöguna og man valið („Mjólk“ → Nýmjólk 1L). Í fyrsta skipti þarf að velja úr 2–3 tillögum. Miðlungs verk.

**Það sem þarf að hafa í huga**
- Aðgangslykill (`act_…`) er búinn til í stillingum Snjallverslunar og krefst **Auðkennis**. Hann fer bara í Supabase Secrets (`KRONAN_ACCESS_TOKEN`), aldrei í appið.
- Aðeins foreldrar fá takkann. Ein karfa: lykillinn tengist einum Krónuaðgangi.
- API-ið er í beta og getur breyst. Takmörk: 200 köll á 200 sek.

**Áður en farið er af stað:** verslum við nógu oft í Snjallversluninni til að þetta borgi sig?

---

## 2. Dagatal: hver tengir sitt eigið dagatal

*Skoðað 13. okt. 2026 · Staða: í bið*

**Hugmyndin:** Hver og einn tengir sitt eigið dagatal (Google, iCloud, Outlook), og viðburðirnir þaðan birtast á honum í appinu, til viðbótar við Heimilið og Heimilið vol.2.

**Hvernig**
- Sama tækni og núna: leynileg iCal-slóð sem `clever-api` les.
- Notandinn límir slóðina inn undir **Myndin mín → Tengja dagatalið mitt**:
  - Google: Settings → *Secret address in iCal format*
  - iCloud: Deila dagatali → *Opinbert dagatal*
  - Outlook: Publish calendar → ICS
- Allt úr því dagatali tilheyrir viðkomandi, svo það þarf ekkert nafn í titlinum.

**Það sem þarf að hafa í huga**
- Bara lestur. Til að skrifa í dagatöl þyrfti OAuth hjá Google/Apple, sem er miklu stærra verk.
- Slóðirnar eru leynilegar og eiga að vera geymdar þannig að aðeins þjónninn sjái þær, ekki aðrir í appinu.
- Valkostur: að sýna eigin viðburði sem „Upptekin/n“ hjá öðrum, t.d. fyrir 16 ára.
- iCloud-tengill er opinber slóð, ekki leynileg. Google uppfærir slóðirnar stundum bara á nokkurra klst fresti.
- Frekar lítið verk, því dagatalskóðinn er til.

**Áður en farið er af stað:** vantar eitthvað í dagatalið í dag? Eru krakkarnir eða við með dagatöl sem fara ekki í Heimilið?
