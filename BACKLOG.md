# Backlog — Fjölskylduvikan

Hugmyndir sem búið er að skoða en ekki útfæra, **raðað eftir forgangi** (1 = næst).
Röðunin vegur saman hversu oft fídusinn nýtist og hversu stórt verkið er.
Til að fá yfirlit: biddu Claude um „yfirlit yfir backlog“ og veldu númer.

**Stærð:** Lítið = nokkrir klukkutímar · Miðlungs = um dagur · Stórt = meira

## Yfirlit

| # | Hugmynd | Hvað það gerir | Stærð | Nýtist |
|---|---|---|---|---|
| 1 | Ertu í mat í kvöld? | Já / Nei / Seinn fyrir kl. 16, fjöldi í mat sést strax | Lítið | Daglega |
| 2 | Uppáhalds á innkaupalistanum | Algengar vörur sem takkar, eitt ýt á listann | Lítið | Daglega |
| 3 | Sunnudagsyfirlitið | Einn skjár fyrir fjölskyldufundinn: stig, bikar, næsta vika | Miðlungs | Vikulega |
| 4 | ~~Story~~ ✅ | **Komið 13. okt. 2026** | Miðlungs | Daglega |
| 5 | Næst á dagskrá og leit | „Næst: Æfing eftir 45 mín“ á forsíðu, leit í dagatali | Lítið | Daglega |
| 6 | Uppskriftabanki | Vistaðir réttir, „Sama og síðasta vika“ á matseðil | Miðlungs | Vikulega |
| 7 | Hver skutlar? | „Ég tek það“ á viðburðum, áminning til bílstjórans | Miðlungs | Nokkrum sinnum í viku |
| 8 | Beiðnir til foreldra | „Má ég …?“ → Já / Nei / Ræðum það | Miðlungs | Nokkrum sinnum í viku |
| 9 | Staðan mín | Komin heim / Á æfingu / Hjá vini / Verð sein | Lítið | Daglega |
| 10 | Virkar án nets | Innkaupalistinn virkar í búðinni þótt netið detti út | Miðlungs | Í hverri búðarferð |
| 11 | Rákir og vikuyfirlit verka | 🔥 dagar í röð, yfirlit fyrir foreldra | Lítið | Daglega |
| 12 | Árleg heimilisverk | Dekkjaskipti, reykskynjarar, gjöld; bara foreldrar | Lítið | Nokkrum sinnum á ári |
| 13 | Upplýsingabók fjölskyldunnar | WiFi, símanúmer, afmæli, fatastærðir | Miðlungs | Stundum |
| 14 | Eigið dagatal hvers og eins | Tengja Google / iCloud / Outlook dagatal | Lítið–miðlungs | Daglega, ef þörf er á |
| 15 | Krónan | Innkaupalistinn í Snjallverslun Krónunnar | Miðlungs | Í hverri pöntun |

---

## 1. Ertu í mat í kvöld?
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Á forsíðu hvers og eins: **„Ertu í mat í kvöld?“** með **Já / Nei / Seinn**, og tíma ef „Seinn“.
- Foreldrar sjá samantekt á kvöldmatarspjaldinu: „4 í mat · Thelma kemur 19:30 · Pétur ekki“.
- Áminning kl. 15:30 til þeirra sem hafa ekki svarað; svarfrestur kl. 16 (hægt að stilla).
- Sjálfgefið „Já“ ef enginn svarar? Ákveða fyrst.

## 2. Uppáhalds á innkaupalistanum
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Efst á innkaupalistanum: takkar með því sem oftast er keypt (mjólk, skyr, brauð, bananar).
- Appið lærir sjálft af því hvað er hakað við í búðinni; foreldrar geta fest vörur.
- Eitt ýt setur vöruna á listann. Ef hún er þar fyrir, gerist ekkert.

## 3. Sunnudagsyfirlitið
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- Einn skjár fyrir fjölskyldufundinn á sunnudagskvöldi, opnaður af foreldri.
- Stigatafla vikunnar og takki til að tilkynna sigurvegarann (sendir skilaboð á alla).
- Næsta vika í dagatalinu, matseðill sem á eftir að skipuleggja, myndir vikunnar og hrós vikunnar.
- Passar við bikarinn sem þið tilkynnið sjálf á sunnudögum.

## 4. Story ✅
*Skoðað 13. okt. 2026 · **Útfært 13. okt. 2026** (js/story.js, supabase/8-story.sql) · Stærð: miðlungs*

**Hugmyndin:** Eins og story á Instagram, bara fyrir fjölskylduna. Myndir sem lifa í 24 klukkutíma og hverfa svo.

**Ákveðið**
- **Bara myndir**, ein eða fleiri í einu. Engin myndbönd, enginn texti ofan á.
- **Nýjar eða gamlar myndir** úr myndasafninu. Gaman að setja inn gamla mynd sem er góð minning.
- Myndirnar **lifa í 24 klst** og hverfa svo alveg.
- **Engin tilkynning** á hópinn þegar einhver setur inn story.
- **Viðbrögð með emoji** (❤️😂😍👏🔥), eins og á Mynd dagsins.
- **Ekkert „séð af“:** sá sem setur inn sér ekki hverjir hafa skoðað.
- **Mynd dagsins helst óbreytt og varanleg** (fer í Árið okkar). Story er sér og hverfur.

**Hvernig það virkar**
- Hringir með myndum fjölskyldunnar efst á forsíðunni. Litaður hringur = story sem þú hefur ekki séð (geymt í símanum, ekki sýnt öðrum).
- Ýtt á hring: opnast á fullum skjá, með framvindustikum efst (ein fyrir hverja mynd).
- Ýtt hægra megin = næsta mynd, vinstra megin = fyrri, haldið niðri = stoppa, strokið niður = loka.
- Eftir síðustu mynd einnar manneskju fer story næsta í röðinni sjálfkrafa af stað.
- **＋ Story** hjá eigin hring: taka mynd eða velja eina eða fleiri úr myndasafni.
- Sá sem setur inn getur eytt sinni story fyrr.

**Tæknin**
- Byggir á sama grunni og Mynd dagsins: minnkun mynda, læst geymsla í Supabase, aðeins fjölskyldan sér.
- Ný tafla `stories` (með `expires_at`) og `story_reactions`.
- Klukkan sem keyrir áminningarnar (á 5 mín fresti) eyðir útrunnum myndum úr geymslunni, svo plássið fyllist ekki.

## 5. Næst á dagskrá og leit
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Efst í „Í dag“: **„Næst: Fótboltaæfing Pétur eftir 45 mín“** í stað þess að lesa allan listann.
- Leit í dagatalinu: „hvenær er næsti tannlæknir?“ leitar fram í tímann.

## 6. Uppskriftabanki
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- Réttir sem eldaðir eru oft vistast með hráefnum (verður til sjálfkrafa úr matseðlinum).
- Velja rétt úr bankanum á dag; hráefnin fara á innkaupalistann eins og núna.
- Takki **„Sama og síðasta vika“** fyllir vikuna á einu ýti.
- Passar vel við „Kokkur vikunnar“ ef þið viljið bæta því við seinna.

## 7. Hver skutlar?
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- Viðburðir sem þarf að keyra á fá **„Hver skutlar?“**; foreldri ýtir á **„Ég tek það“**.
- Sá sem keyrir fær áminningu 20 mín fyrir; barnið sér hver sækir.
- Hvaða viðburðir? T.d. þeir sem hafa staðsetningu, eða merki í titli. Ákveða fyrst.
- Dagatalið er bara lesið úr Google, svo skutlið er geymt í appinu, ekki í Google.

## 8. Beiðnir til foreldra
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- Börnin senda beiðni: „Má ég gista hjá Söru?“, „Getur einhver sótt mig kl. 21?“, „Má ég fá pening fyrir bíó?“
- Foreldrar fá tilkynningu og svara **Já / Nei / Ræðum það**; barnið fær svarið sem tilkynningu.
- Allt á einum stað, ekki týnt í SMS-þráðum. Saga yfir síðustu beiðnir.

## 9. Staðan mín
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Einn takki fyrir krakkana: **Komin heim 🏠 / Á æfingu ⚽ / Hjá vini 👋 / Verð sein ⏰**.
- Foreldrar sjá stöðuna á forsíðunni. Engin staðsetning eða eftirlit.
- Staðan rennur út eftir nokkra klukkutíma svo gömul staða sitji ekki eftir.

## 10. Virkar án nets
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- Innkaupalistinn (og forsíðan) opnast án nets, úr síðasta afriti í símanum.
- Hak og nýjar vörur vistast í símanum og samstillast þegar netið kemur.
- Árekstrar: ef tveir haka við sama hlut gerist ekkert slæmt; ef vöru er eytt á meðan, vinnur eyðingin.

## 11. Rákir og vikuyfirlit verka
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Rák á verkum dag eftir dag: „Búa um rúmið 🔥 12 dagar“. Rákin brotnar ef dagur dettur út.
- Fyrir foreldra: yfirlit yfir vikuna, hver gerði hvað og hvaða verk gleymast oftast.
- Börnin sjá bara sínar rákir, eins og með stigin.

## 12. Árleg heimilisverk
*Skoðað 13. okt. 2026 · Stærð: lítið*

- Áminningar sem gerast einu sinni eða nokkrum sinnum á ári: nagladekk af 15. apríl, rafhlöður í reykskynjara, sía í háfnum, fasteignagjöld, æfingagjöld í byrjun annar.
- Bara foreldrar sjá þetta. Byggir á áminningunum sem eru til, með „árlega“ eða „mánaðarlega“ endurtekningu.

## 13. Upplýsingabók fjölskyldunnar
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

- WiFi-lykilorð (líka fyrir gesti), símanúmer (skólinn, heilsugæslan, ömmur og afar), skápakóðar.
- Afmæli í stórfjölskyldunni með áminningu viku fyrir.
- Fatastærðir og skóstærðir krakkanna, sem passar við óskalistana.
- Sumt er viðkvæmt: ákveða hvað börnin sjá.

## 14. Eigið dagatal hvers og eins
*Skoðað 13. okt. 2026 · Stærð: lítið–miðlungs*

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

**Áður en farið er af stað:** vantar eitthvað í dagatalið í dag? Eru krakkarnir eða við með dagatöl sem fara ekki í Heimilið?

## 15. Krónan: innkaupalistinn í Krónuna
*Skoðað 13. okt. 2026 · Stærð: miðlungs*

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
