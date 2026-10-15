# Framtíðarpælingar — Fjölskylduvikan

Stærri hugmyndir sem eiga heima í appinu **þegar það er komið lengra**: fleiri fjölskyldur, eigin innskráning fyrir hvern og einn, mögulega á markað. Þær eru ekki á [BACKLOG.md](BACKLOG.md) því þær byggja á grunni sem er ekki til ennþá. Lausar smærri hugmyndir eru í [HUGMYNDIR.md](HUGMYNDIR.md).

---

## 🧩 Hub fjölskyldunnar: grunnur + tengingar
*Skráð 15. okt. 2026 · Stóra myndin sem margar hugmyndirnar hér fyrir neðan falla undir*

**Hugmyndin:** appið er **grunnur** (dagatal, matur, verk, skilaboð, samvera) og svo velur hver fjölskylda **tengingar** við öppin sem hún notar nú þegar. Allt kemur saman á einum stað, svo foreldrar þurfi ekki að opna sex öpp til að vita hvað er í gangi. Fjölskylduvikan verður yfirsýnin, ekki enn eitt appið.

**Tengingar sem koma til greina**

| Tenging | Hvað kemur inn | Hvernig það gæti tengst |
|---|---|---|
| Google (dagatal, Gmail) | Viðburðir, mögulega póstur frá skóla/félögum | „Skrá inn með Google“ (OAuth) |
| Outlook / Microsoft 365 | Vinnudagatal (bara „Upptekinn“), póstur | „Skrá inn með Microsoft“ |
| iCloud-dagatal | Viðburðir | iCal-slóð |
| Abler (Sportabler) | Æfingar, leikir, mætingar, æfingagjöld | Athuga hvort til er API eða iCal; annars áframsendur póstur |
| Mentor | Skóladagatal, starfsdagar, tilkynningar, heimavinna | Athuga API/iCal; annars áframsendur póstur |
| Krónan | Innkaupalisti → karfa → pöntun | Snjallverslun Krónunnar (sjá hér að neðan) |
| Strava / Coros / Garmin | Fjölskylduáskorun mánaðarins | OAuth, opin API |
| Bankinn / Meniga | Sameiginleg útgjöld, tómstundagjöld | Síðar; viðkvæm gögn |

**Hvernig það virkar fyrir notandann**
- Undir **Stillingar → Tengingar** er listi yfir öpp með „Tengja“-takka, eins og í Slack eða Notion.
- Hver tenging segir skýrt **hvað hún les og hver sér það** („Abler: æfingar Péturs, sýnilegt allri fjölskyldunni“).
- Tenging skilar sér í það sem fjölskyldan þekkir nú þegar: viðburðir í dagatalið, áminningar á réttan mann, vörur á listann. Ekki nýir skjáir fyrir hvert app.
- Hægt að aftengja hvenær sem er, og þá er öllu sem kom inn í gegnum hana eytt.

**Hvernig það er byggt**
- **Ein sameiginleg mynd af gögnum:** allt sem kemur inn verður að *viðburði*, *áminningu*, *verki* eða *vöru á lista*, merkt manneskju. Hver tenging er lítill „þýðandi“ yfir í þessa mynd. Ný tenging = nýr þýðandi, ekkert annað breytist.
- **Þrjár gerðir tenginga**, eftir því hvað hvert app býður:
  1. **Opin API / innskráning (OAuth):** Google, Microsoft, Strava. Best og öruggast.
  2. **Dagatalsslóð (iCal):** virkar nú þegar í appinu.
  3. **Áframsendur póstur + gervigreind:** fyrir öpp án API (sjá „Skólinn og íþróttafélögin beint inn“). Foreldri samþykkir allt sem kemur inn þannig.
- Tengingarnar keyra á þjóninum (Supabase Edge Functions), ekki í símanum, svo þær uppfærast líka þegar appið er lokað.

**Viðskiptahliðin**
- **Grunnurinn** er það sem allir fá (í prufu og áskrift). **Tengingar** gætu verið hluti af hærra verðþrepi, t.d. „Fjölskylduvikan+ með tengingum“.
- Tengingarnar eru það sem **erfiðast er að herma eftir**: erlend öpp tengjast ekki Abler, Mentor eða Krónunni. Það er íslenskt forskot, og sama hugsun gildir í hverju landi (staðbundin skóla- og íþróttakerfi).
- **Samstarf í stað samkeppni:** Abler, Mentor og Krónan fá betri leið að foreldrum. Mögulegt að þau greiði fyrir eða kynni tenginguna.
- Hver ný tenging gerir appið verðmætara fyrir þá sem eru þegar komnir, og gerir það erfiðara að hætta.

**Í hvaða röð**
1. Google- og Microsoft-dagatöl með innskráningu (kemur í stað iCal-leyndarmála; byggir á „Mörg dagatöl á hvern og einn“).
2. Abler og Mentor, fyrst með iCal ef það er til, annars með áframsendum pósti.
3. Krónan (byrjar á #15 á backlog).
4. Hreyfing (Strava/Coros/Garmin) fyrir fjölskylduáskorunina.

**Það sem þarf að vera til staðar fyrst**
- Eigin innskráning hvers og eins og allar fjölskyldur í einu kerfi (sama endursmíði og annað hér).
- Persónuvernd: hver tenging þarf skýrt samþykki og vinnslusamning; gögn um börn úr skóla eru sérlega viðkvæm.
- Samtöl við Abler, Mentor og Krónuna um hvað þau geta opnað.

**Tengist:** „Skólinn og íþróttafélögin beint inn“, „Full tenging við Krónuappið“, „Mörg dagatöl á hvern og einn“ og #14 og #15 á backlog. Þessar hugmyndir eru í raun einstakar tengingar í þessum hub.

---

## 🤖 Gervigreind yfir öllu: árekstrar og það sem þarf að sinna
*Skráð 15. okt. 2026 · Lagið ofan á hubinn*

**Hugmyndin:** þegar tengingarnar eru komnar les gervigreind **alla grunnana saman**: dagatöl foreldra (líka vinnu), Abler, Mentor, matseðil, innkaupalista og verk. Hún finnur það sem enginn einn grunnur sér: árekstra, gleymd atriði og það sem þarf að gera **áður** en það verður vandamál. Foreldrar fá ekki fleiri gögn, heldur stuttan lista yfir það sem þarf að ákveða.

**Dæmi um það sem hún finnur**
- **Árekstrar:** „Þriðjudag: Alma í fimleikum kl. 17 (Abler) og Pétur í leik kl. 17:15 í Egilshöll, en Kristín er á fundi til 18 (Outlook). Hver skutlar?“
- **Undirbúningur:** „Föstudagur er starfsdagur (Mentor) en báðir foreldrar eru í vinnu. Á að biðja ömmu?“
- **Hlutir sem gleymast:** „Bleikur dagur á morgun“, „Muna 2.000 kr. fyrir vettvangsferð“, „Æfingagjald Abler á gjalddaga á mánudag“.
- **Matur og innkaup:** „Lasagna á miðvikudag, en enginn heima fyrir kl. 19 (leikur + fundur). Skipta við föstudagsréttinn?“ / „Vantar hakk á listann fyrir matseðil vikunnar.“
- **Álag:** „Þessi vika er þung: 9 skutl, 3 kvöld þar sem báðir foreldrar eru uppteknir.“

**Hvernig það birtist**
- **Sunnudagskvöld:** „Vikan framundan“ með árekstrum merktum og tillögum. Foreldrar ýta á „Ég tek það“, „Biðja ömmu“ eða „Hunsa“. Passar við Sunnudagsyfirlitið (#3) og skutl-planið.
- **Daglega:** í mesta lagi eitt til tvö atriði efst á forsíðu foreldra, bara ef eitthvað þarf að ákveða. Ekkert ef allt er í lagi.
- **Spurðu appið:** „Hvenær er næsti frídagur í skólanum?“, „Hver er laus á fimmtudag kl. 16?“

**Reglur sem skipta máli**
- **Gervigreindin stingur upp á, foreldrar ákveða.** Hún breytir engu sjálf, bókar ekkert og sendir engum skilaboð nema foreldri samþykki.
- **Börnin sjá ekki** árekstra eða álag foreldra, bara það sem þau varðar („Pabbi sækir þig kl. 17“).
- **Vinnudagatöl** eru lesin sem „Upptekinn“, ekki titlar og fundarefni.
- **Persónuvernd:** gögnin fara aðeins til gervigreindar sem geymir þau ekki og notar ekki til þjálfunar. Skýrt í skilmálum.

**Hvernig það er byggt**
- Allir grunnar eru nú þegar þýddir yfir í sömu mynd (viðburðir, áminningar, verk, vörur) í hubnum. Gervigreindin les þá mynd, ekki hvert app fyrir sig.
- **Fyrst reglur, svo gervigreind:** einfaldir árekstrar (tveir staðir á sama tíma, enginn foreldri laus) finnast með venjulegum kóða, ódýrt og örugglega. Gervigreindin bætist við fyrir það sem þarf að skilja: póst, „bleikan dag“, hvað er mikilvægt og hvernig á að orða það.
- Keyrir á þjóninum t.d. einu sinni á dag og á sunnudagskvöldi, auk þess þegar eitthvað nýtt kemur inn.

**Kostnaður og viðskiptahlið**
- Kostnaður við gervigreind er eftir notkun; með reglum fyrst og samantekt einu sinni á dag ætti hann að vera nokkrar krónur á fjölskyldu á mánuði (þarf að mæla).
- Þetta er sterkasta ástæðan fyrir hærra verðþrepi: **„appið sem hugsar fyrir þriðju vaktina“**. Ekkert annað fjölskylduapp á Íslandi les skóla, íþróttir, vinnu og mat saman.

**Það sem þarf að vera til staðar fyrst**
- Hubinn með tengingum (hér að ofan), a.m.k. dagatöl foreldra og Abler/Mentor.
- „Hver skutlar?“ (#7) svo hægt sé að úthluta.
- Gestir (ömmur og afar) til að geta stungið upp á þeim.

**Tengist:** „Árekstrar og skutl-plan“ (það er fyrsta útgáfan af þessu, án gervigreindar), „Skólinn og íþróttafélögin beint inn“ og „Mynd af blaði → viðburðir“ (sama gervigreind les póst og myndir).

---

## 🚌 Strætó: „Farðu út núna, vagninn kemur eftir 6 mín“
*Skráð 15. okt. 2026 · Ein tenging í hubnum*

**Hugmyndin:** barnið fær tilkynningu þegar það þarf að leggja af stað út á stoppistöð, miðað við hvar vagninn er í rauntíma. Ekki bara „Leið 15 kl. 16:42“ heldur „Farðu út núna, 15 kemur á Hlemm eftir 6 mín“.

**Hvernig það virkar fyrir barnið**
- Barnið (eða foreldri) vistar **stoppistöðvar og ferðir**: „Heim úr skólanum: leið 14 frá Melaskóla“, „Á æfingu: leið 15 frá Hlemmi“, og hve lengi það er að ganga á stoppistöðina.
- **Tengt dagatalinu:** appið veit að Alma á fimleika kl. 17 og stingur upp á vagni sem nær þangað í tíma.
- **Tilkynning á réttum tíma:** „Leið 15 kemur eftir 8 mín, þú ert 4 mín að ganga. Farðu eftir 4 mín.“ Ef vagninn er seinn færist tilkynningin.
- Á heimaskjá barnsins: „Næsti vagn heim: 14 eftir 11 mín“.
- **Foreldri getur fengið** „Alma tók 15 kl. 16:44“ ef barnið ýtir á „Ég er komin í vagninn“ (handvirkt, engin rakning).

**Gögnin**
- Strætó birtir tímatöflur sem opin gögn (GTFS) og rauntímastaðsetningu vagna. Sækja þarf um aðgang að rauntímagögnunum hjá Strætó (straeto.is → Opin gögn).
- Þjónninn (Supabase) les rauntímann fyrir þær stoppistöðvar sem fjölskyldan hefur vistað, bara á þeim tímum sem skipta máli, og sendir push-tilkynningu eins og áminningarnar gera í dag.

**Af hverju þetta er gott**
- Virkar **án staðsetningar barnsins**: stoppistöðin er vistuð, ekki síminn rakinn. Mun léttara í persónuvernd en „Hvar er fjölskyldan?“.
- Gefur unglingum sjálfstæði og foreldrum ró, og er nokkuð sem börn nota daglega.
- Virkar líklega sem vefapp með push-tilkynningum eins og í dag; native app ekki forsenda.

**Það sem þarf að skoða**
- Skilmálar Strætó um notkun rauntímagagna í appi sem greitt er fyrir.
- Hversu nákvæmur rauntíminn er og hvernig á að bregðast við seinkunum og niðurfelldum ferðum.
- Utan höfuðborgarsvæðisins: landsbyggðarvagnar og önnur sveitarfélög.

**Tengist:** hubnum (ein tenging enn), „Næst á dagskrá“ (#5, komið), og skutl-planinu („Pétur tekur strætó á æfingu, enginn þarf að skutla“).

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
