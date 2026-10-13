# Hugmyndir — Fjölskylduvikan

Lausar hugmyndir sem ekki er búið að skoða nánar eða raða. Þegar hugmynd þykir góð er hún skoðuð betur og færð á [BACKLOG.md](BACKLOG.md).

---

## 📖 Story (eins og á Instagram)
*Bætt við 13. okt. 2026 · Stærð: miðlungs (um dagur)*

**Útfærslan sem Oddur vill**
- **Bara myndir**, ein eða fleiri í einu. Engin myndbönd, enginn texti ofan á.
- Myndirnar **lifa í 24 klukkutíma** og hverfa svo.
- **Engin tilkynning** á hópinn þegar einhver setur inn story.

**Hvernig það myndi virka**
- Hringir með myndum fjölskyldunnar efst á forsíðunni. Litaður hringur = story sem þú hefur ekki séð.
- Ýtt á hring: opnast á fullum skjá, með framvindustikum efst (ein fyrir hverja mynd).
- Ýtt hægra megin = næsta mynd, vinstra megin = fyrri, haldið niðri = stoppa, strokið niður = loka.
- Eftir síðustu mynd einnar manneskju fer story næsta í röðinni sjálfkrafa af stað.
- Takki **＋ Story** hjá eigin hring: taka mynd eða velja úr myndasafni (fleiri en eina).
- Sá sem setur inn getur eytt sinni story fyrr.

**Tæknin**
- Byggir á sama grunni og Mynd dagsins: minnkun mynda, læst geymsla í Supabase, aðeins fjölskyldan sér.
- Ný tafla fyrir stories (með `expires_at`) og fyrir „séð“.
- Klukkan sem keyrir áminningarnar (á 5 mín fresti) eyðir útrunnum myndum úr geymslunni, svo plássið fyllist ekki.

**Opnar spurningar**
- **Séð af:** á sá sem setur inn að sjá hverjir hafa skoðað?
- **Viðbrögð:** ❤️😂😍 eins og á Mynd dagsins, eða ekkert?
- **Mynd dagsins:** halda báðu? Tillaga: Mynd dagsins er varanleg (fer í Árið okkar), story hverfur. Möguleiki: takki „Gera að mynd dagsins“ á eigin story.
- **Myndir eldri en í dag:** má velja gamlar myndir úr myndasafninu, eða bara myndir frá deginum, eins og í Mynd dagsins?

---

## Skemmtun og samvera
*Bætt við 13. okt. 2026*

### Leikir og keppni

**🧠 Spurning dagsins**
Ein spurning á dag, sú sama fyrir alla: Íslandssaga, fótbolti, tónlist, landafræði. Allir svara í laumi, og svörin birtast um kvöldmatarleytið. Stigatafla yfir mánuðinn, og foreldrarnir keppa líka.

**🤔 Hver í fjölskyldunni …?**
„Hver myndi lifa lengst af á eyðieyju?“, „Hver er líklegastur til að gleyma símanum?“ Allir kjósa nafnlaust, og niðurstaðan birtist um kvöldið. Kveikir fyndin samtöl við matarborðið.

**🎯 Spáðu fyrir vikunni**
Á mánudegi spá allir: „Hver vinnur bikarinn?“, „Hvað verður oftast á matseðlinum?“, „Rignir á laugardag?“ Á sunnudegi er farið yfir hverjir höfðu rétt fyrir sér. Passar við sunnudagsfundinn.

**🏃 Fjölskylduáskorun mánaðarins**
Sameiginlegt markmið allra, t.d. 300 km samanlagt á mánuði (gengið, hlaupið, hjólað). Framvindan sést sem ferðalag um Ísland: „Komin frá Reykjavík til Akureyrar!“ Hægt að tengja við Strava eða Coros.

### Minningar og samvera

**📅 Á þessum degi**
„Fyrir ári síðan“: myndin, hrósið eða brandarinn frá þessum degi í fyrra birtist á forsíðunni. Verður betra með hverju árinu.

**🎬 Föstudagskvöld**
Hver og einn stingur upp á bíómynd eða spili í vikunni, og á föstudegi kýs fjölskyldan. Þeir sem tapa fá forgang næst, svo allir fá sitt.

**🗺️ Fjölskyldulisti yfir hluti sem á að gera**
„Fara í Þórsmörk“, „Prófa kajak“, „Baka risastóra pizzu saman“. Hver bætir við, og þegar hlutur er búinn fylgir mynd með. Úr verður saga yfir það sem fjölskyldan hefur gert saman.

**💌 Tímahylki**
Hver og einn skrifar skilaboð til sín eða fjölskyldunnar sem opnast eftir ár, t.d. á gamlárskvöld. „Hvað heldurðu að verði breytt eftir ár?“

### Litlir hlutir sem gleðja

**🎂 Afmælisstilling**
Á afmælisdegi breytist appið hjá öllum: konfetti, mynd afmælisbarnsins efst, og allir minntir á að senda hrós. Afmælisbarnið velur kvöldmatinn.

**🏅 Merki og afrek**
Leynileg merki sem opnast: „Næturugla“ (mynd dagsins eftir kl. 23), „Hrósmeistari“ (10 hrós send), „Kokkurinn“ (valdi 5 rétti), „Snemmbúinn“ (öll verk búin fyrir kl. 8). Gaman að uppgötva þau óvart.

**😂 Fjölskyldubrandarar**
Hver og einn getur sent inn sína eigin brandara í „Brandara dagsins“, og innanhússbrandarar fjölskyldunnar blandast inn í safnið. Höfundurinn sést þegar svarið er opnað.

### Uppáhalds Claude
- **Spurning dagsins**: einföld, daglega, og passar við keppnisskapið með bikarnum.
- **Fjölskylduáskorunin**: allir vinna saman í stað þess að keppa; tengist hlaupunum.
- **Afmælisstilling**: lítil, en börnin muna eftir henni.
