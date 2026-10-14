# Framtíðarpælingar — Fjölskylduvikan

Stærri hugmyndir sem eiga heima í appinu **þegar það er komið lengra**: fleiri fjölskyldur, eigin innskráning fyrir hvern og einn, mögulega á markað. Þær eru ekki á [BACKLOG.md](BACKLOG.md) því þær byggja á grunni sem er ekki til ennþá. Lausar smærri hugmyndir eru í [HUGMYNDIR.md](HUGMYNDIR.md).

---

## 🛒 Full tenging við Krónuappið
*Skráð 14. okt. 2026*

**Hugmyndin:** innkaupalistinn fer beint í körfu í Krónunni og hægt er að klára pöntunina, þ.e. velja afhendingu og borga, án þess að fara úr Fjölskylduvikunni.

**Hvernig það tengist backlog:** #15 á backlog er fyrsta skrefið: listinn fer á minnismiða eða í körfu í Snjallverslun Krónunnar, en greitt er í Krónuappinu. Þetta er framhaldið.

**Það sem þarf að vera til staðar fyrst**
- Krónan þarf að opna fyrir greiðslu og val á afhendingartíma í API-inu sínu. Í okt. 2026 er það „coming soon“ hjá þeim.
- Samningur eða samstarf við Krónuna, ef appið fer á markað. Óopinber tenging dugar fyrir okkur, ekki fyrir aðrar fjölskyldur.
- Hver fjölskylda tengir sinn eigin Krónuaðgang (í dag krefst það Auðkennis og lykils sem búinn er til í Snjallversluninni).

**Pælingar**
- Hver má panta? Líklega bara foreldrar, og pöntun yfir ákveðinni upphæð þarf samþykki hins foreldrisins.
- Matseðill vikunnar → hráefni → karfa → pöntun í einu flæði.
- Aðrar verslanir síðar (Bónus, Nettó) ef þær opna API.

---

## 👵 Bjóða ömmum og öfum inn
*Skráð 14. okt. 2026*

**Hugmyndin:** foreldrar geta boðið ömmum, öfum og öðrum nánum, t.d. barnapíu, inn í appið sem **gestum**. Þá geta þau fengið áminningar og séð það sem skiptir þau máli þegar þau sækja og skutla, eða þegar krakkarnir eru hjá þeim.

**Hvað gestur sér og gerir**
- **Áminningar:** foreldrar geta sett áminningar á gestinn, t.d. „Sækja Ölmu í fimleika kl. 17:00“, og gesturinn fær tilkynningu í símann.
- **Dagatal:** bara viðburðir sem gesturinn er merktur á, eða þá daga sem krakkarnir eru hjá honum. Ekki allt dagatal fjölskyldunnar.
- **Skilaboð:** gesturinn fær skilaboð frá foreldrum og getur svarað „Komin með þau“.
- Mögulega mynd dagsins og story, ef foreldrar leyfa.
- **Ekki:** innkaupalisti, heimilisverk, stigatafla, upplýsingabók (nema það sem er merkt fyrir gesti, t.d. WiFi).

**Hvernig boðið virkar**
- Foreldri ýtir á „Bjóða inn“ og sendir tengil í SMS. Gesturinn opnar hann, setur appið á heimaskjáinn og velur PIN.
- Gesturinn getur tilheyrt fleiri en einni fjölskyldu, t.d. amma með þrjú barnabörn í tveimur fjölskyldum. Þá sér hún allar í sama appinu.
- Foreldrar geta tekið aðganginn af hvenær sem er.

**Það sem þarf að vera til staðar fyrst**
- Eigin innskráning fyrir hvern og einn, ekki einn sameiginlegur aðgangur eins og í dag. Það er sama endursmíði og þarf fyrir markaðinn (sjá viðskiptaáætlunina: „Margar fjölskyldur í sama kerfi“).
- Hlutverkið **gestur** við hliðina á foreldri og barni, með öryggisreglum í gagnagrunninum sem takmarka hvað gestur sér.
- „Hver skutlar?“ (#7 á backlog) passar beint við þetta: amma getur tekið skutlið.

---

## 📨 Skólinn og íþróttafélögin beint inn
*Skráð 14. okt. 2026*

**Hugmyndin:** póstur frá Mentor, Sportabler/Abler, þjálfurum og foreldrafélögum er lesinn sjálfkrafa og verður að viðburði eða áminningu í appinu. Í dag les annað foreldrið allt þetta og ber það í höfðinu.

**Dæmi**
- „Bleikur dagur á föstudaginn“ → áminning á barnið kvöldið áður.
- „Mæting kl. 8:30 á laugardag í Egilshöll“ → viðburður í dagatalinu, merktur réttu barni.
- „Muna 2.000 kr. fyrir vettvangsferð fyrir miðvikudag“ → áminning á foreldri.

**Hvernig það gæti virkað**
- Fjölskyldan fær sitt eigið netfang í appinu (t.d. `prufa1@inn.fjolskylduvikan.is`) og áframsendir á það, eða setur upp sjálfvirka áframsendingu frá skólanum.
- Gervigreind les póstinn, finnur dagsetningar, tíma, staði og hvaða barn á í hlut, og stingur upp á viðburði eða áminningu.
- **Foreldri samþykkir** áður en nokkuð fer inn („3 nýjar tillögur úr skólapóstinum“), svo ekkert vitlaust lendi í dagatalinu.

**Það sem þarf að skoða**
- Hvort Mentor og Sportabler/Abler bjóða upp á API eða dagatalsslóð (iCal), sem væri einfaldara og öruggara en að lesa póst.
- Persónuvernd: póstur um börn er viðkvæmur. Aðeins það sem þarf er geymt, og pósturinn sjálfur er ekki geymdur.
- Kostnaður við gervigreind á hvern póst.

---

## 📸 Mynd af blaði eða skjámynd → viðburðir
*Skráð 14. okt. 2026*

**Hugmyndin:** taka mynd af æfingatöflu, boðskorti í afmæli, skólapósti eða skjámynd úr Messenger, og appið breytir henni í viðburði og áminningar.

**Dæmi**
- Æfingatafla vetrarins → allar æfingar sem endurteknir viðburðir á réttu barni.
- Boðskort: „Afmæli Kötlu laugardaginn 25. okt kl. 14–16, Fjólugötu 3“ → viðburður + áminning um að kaupa gjöf.
- Skjámynd af skilaboðum úr foreldrahópnum → viðburður.

**Hvernig það gæti virkað**
- Takki „Úr mynd“ í dagatalinu og áminningunum. Gervigreind les myndina og sýnir tillögur sem foreldri lagar og samþykkir.
- Sama vél og „Skólinn beint inn“, bara önnur leið inn. Gott að byggja þær saman.

**Athugið:** dagatalið er í dag bara lesið úr Google. Til að appið geti búið til viðburði þarf annaðhvort að skrifa þá inn í Google-dagatalið (heimild til að skrifa) eða geyma þá í appinu sjálfu.

---

## 🏠 Tvö heimili
*Skráð 14. okt. 2026*

**Hugmyndin:** fyrir foreldra sem búa ekki saman. Barnið er með eitt app óháð því hvar það er, og hvort heimili sér það sem því tengist.

**Það sem það gerir**
- **Umgengnisdagatal:** „Hjá mömmu þessa viku, hjá pabba næstu“, viku-á-viku eða önnur skipting. Breytingar („getum við skipt helginni?“) eru beðnar um og samþykktar í appinu.
- **Hvar er dótið?** Íþróttataskan, spjaldtölvan, lyfin. Hægt að merkja hvað fer á milli heimila við skiptin.
- **Sameiginleg útgjöld:** tómstundir, föt og tannlæknir, hver borgaði og hvað skiptist. Engar millifærslur í appinu, bara yfirlit.
- **Upplýsingar sem báðir þurfa:** stærðir, læknir, skóli. Samnýtt úr Upplýsingabókinni.

**Hvernig það gæti virkað**
- Barnið tilheyrir tveimur heimilum. Hvort heimili er eins og fjölskylda í dag, með sín eigin verk, innkaupalista og matseðil. Bara barnið og það sem það varðar er samnýtt.
- Hvort heimili ákveður hvað hinu er sýnt. Ekkert annað er deilt á milli.
- Á heimaskjá barnsins stendur hvar það er í dag og hvar það verður næst.

**Af hverju þetta er áhugavert**
- Stór hópur fjölskyldna, og fá fjölskylduöpp sinna þessu vel. Sterkur sölupunktur ef appið fer á markað.
- Krefst sömu endursmíði og annað hér: eigin innskráning hvers og eins og fólk sem tilheyrir fleiri en einni fjölskyldu (eins og ömmur og afar í gestahugmyndinni).

---

## 🚗 Árekstrar og skutl-plan
*Skráð 14. okt. 2026*

**Hugmyndin:** appið sér fyrir fram hvenær skipulagið gengur ekki upp og stingur upp á lausn, í stað þess að foreldrar uppgötvi það kl. 16:45 á þriðjudegi.

**Dæmi**
- „Á þriðjudag þarf Alma skutl í fimleika kl. 17 og Pétur í fótbolta kl. 17:15, en Kristín er á fundi til 18.“
- „Á fimmtudag eru báðir foreldrar uppteknir þegar sækja þarf Thelmu. Á að biðja ömmu?“

**Hvernig það gæti virkað**
- **Sunnudagskvöld:** yfirlit yfir vikuna með árekstrum merktum, sem passar við Sunnudagsyfirlitið (#3 á backlog). Foreldrar úthluta skutli: „Ég tek það“.
- **Hver tekur hvað:** byggir á „Hver skutlar?“ (#7 á backlog). Sá sem tekur skutl fær áminningu með tíma og stað.
- **Ferðatími:** appið reiknar hvenær þarf að leggja af stað miðað við staðsetningu viðburðarins, og varar við ef tveir staðir eru of langt hvor frá öðrum á sama tíma.
- **Lausn:** ef enginn foreldri er laus er stungið upp á gesti (ömmu, afa) og honum sent boð um að taka skutlið, sem passar við gestahugmyndina hér að ofan.

**Það sem þarf að vera til staðar fyrst**
- Dagatöl foreldra með vinnu og fundum, ekki bara fjölskyldudagatalið. Það byggir á „Eigið dagatal hvers og eins“ (#14 á backlog).
- Viðburðir barna merktir sem „þarf skutl“, annaðhvort handvirkt eða út frá staðsetningu.
- Gestir (ömmur og afar) í appinu, til að geta beðið þá.
- Kortaþjónusta fyrir ferðatíma, t.d. Google Maps. Hún kostar eftir notkun.

**Stóra myndin:** þetta er sú vinna í „3. vaktinni“ sem enginn sér en tekur mest. Samræmingin, ekki aksturinn sjálfur.

---

## 📍 Hvar er fjölskyldan? (staðsetning)
*Skráð 14. okt. 2026*

**Hugmyndin:** eins og Life360 eða Find My, en innbyggt í Fjölskylduvikuna og tengt dagskránni. Í stað þess að sýna bara punkta á korti segir appið það sem skiptir máli: **„Alma er komin á æfingu“**, **„Pétur lagði af stað heim úr skólanum“**, **„Kristín er 10 mín frá Egilshöll“**.

**Það sem það gerir**
- **Kort fjölskyldunnar:** hver og einn sem deilir sést á korti, með sínum lit og avatar.
- **Staðir:** heima, skólinn, íþróttahúsin, amma. Tilkynning þegar barn kemur á stað eða fer þaðan („Thelma komin heim 15:42“).
- **Tengt dagatalinu:** appið veit að Pétur á að vera í fótbolta kl. 17. Ef hann er ekki kominn kl. 17:10 fá foreldrar spurningu, ekki viðvörun.
- **Skutl:** sá sem sækir sér hvar barnið er, og barnið sér „Pabbi er 5 mín í burtu“. Passar við „Hver skutlar?“ (#7) og skutl-planið hér að ofan.
- **„Ég er komin“ með einu ýti** fyrir þau sem vilja ekki deila staðsetningu sjálfkrafa.

**Hvernig það yrði sett upp**
1. **Native app þarf fyrst.** Vefapp (eins og Fjölskylduvikan er í dag) fær aðeins staðsetningu meðan appið er opið á skjánum. Til að fylgjast með í bakgrunni þarf appið að vera í App Store / Google Play (sama umslag og nefnt er í viðskiptaáætluninni) með leyfi fyrir staðsetningu „alltaf“.
2. **Staðir (geofences)** frekar en stöðug rakning. Síminn lætur vita þegar komið er inn á eða út af stað. Sparar rafhlöðu og er minna ágengt.
3. **Gögnin:** síðasta staðsetning hvers og eins geymd í Supabase, aðeins sýnileg fjölskyldunni. Ferðasaga geymd stutt (t.d. 24 klst.) eða alls ekki.
4. **Tilkynningar** í gegnum sömu push-tilkynningar og appið notar í dag.

**Af hverju ekki bara tengjast Life360 eða Find My?**
Hvorugt býður upp á opna tengingu sem önnur öpp geta notað, og Google-staðsetningardeiling ekki heldur. Það þyrfti því að smíða þetta sjálf.

**Persónuvernd og traust (mikilvægast)**
- Staðsetning barna er með viðkvæmustu gögnum sem til eru. Þarf skýrt samþykki, hýsingu innan EES og lögfræðiyfirferð.
- **Allir sjá hverjir sjá sig.** Engin leynileg rakning. Á skjá barnsins stendur alltaf „Mamma og pabbi sjá hvar þú ert“.
- **Unglingar (t.d. 15+) geta gert hlé** í ákveðinn tíma og foreldrar sjá að það er í hléi. Life360 hefur fengið mikla gagnrýni frá unglingum; traust skiptir meira en nákvæmni.
- Foreldrar deila líka sinni staðsetningu. Þetta er fjölskylduapp, ekki eftirlitsapp.

**Það sem þarf að vera til staðar fyrst**
- Native app (App Store / Google Play).
- Eigin innskráning hvers og eins (sama endursmíði og annað hér).
- „Staðan mín“ (#9 á backlog) er góður fyrsti áfangi: handvirkt „Komin heim / Á æfingu“ sem síðar getur orðið sjálfvirkt.

**Kostnaður:** kortaþjónusta (t.d. Mapbox eða Google Maps) kostar eftir notkun; geofence í símanum sjálfum kostar ekkert.

---

## 📅 Mörg dagatöl á hvern og einn (vinna, einkalíf, fyrirtæki)
*Skráð 14. okt. 2026*

**Hugmyndin:** hvert foreldri getur tengt mörg dagatöl: vinnu-Outlook, persónulegt dagatal og dagatöl fyrirtækja eða annars reksturs. Fjölskyldan sér þá hvenær foreldrar eru uppteknir, og skutl-planið hér að ofan getur nýtt það.

**Athugið:** þetta snýst um dagatöl, ekki tölvupóst. Að lesa póst er í „Skólinn og íþróttafélögin beint inn“.

**Staðan í dag**
- Það virkar nú þegar að tengja mörg dagatöl: öll leyndarmál í Supabase sem byrja á `ICAL_` eru lesin.
- En aðeins `ICAL_<nafn>` (t.d. `ICAL_ODDUR`) fer á viðkomandi. `ICAL_ODDUR_VINNA` færi á alla fjölskylduna, svo vinnufundir myndu birtast hjá krökkunum.

**Það sem þarf að gera**
1. **Rétt manneskja:** `ICAL_ODDUR_VINNA`, `ICAL_ODDUR_FYRIRTAEKI1` o.s.frv. fari öll á Odd (lítil breyting í clever-api).
2. **„Upptekinn“ í stað titils:** viðburðir úr vinnu- og fyrirtækjadagatölum sýndir sem „Upptekinn“, og bara foreldrum. Börnin sjá ekki fundina.
3. **Lit eða merki eftir dagatali**, t.d. 💼 fyrir vinnu, svo það sjáist hvaðan viðburðurinn kemur.

**Hvernig slóðirnar fást**
- **Outlook / Microsoft 365:** Outlook á vefnum → Stillingar → Dagatal → Samnýtt dagatöl → *Birta dagatal* → afrita ICS-slóðina. Hægt að velja „Aðeins hvenær ég er upptekinn“. Sumir vinnustaðir loka fyrir þetta.
- **Google / Workspace:** stillingar dagatalsins → *Leynilegt heimilisfang á iCal-sniði*.

**Tengist:** #14 „Eigið dagatal hvers og eins“ á backlog. Fyrir markað ætti þetta að verða „Skrá inn með Google / Microsoft“ í stað þess að líma slóðir inn í Supabase.
