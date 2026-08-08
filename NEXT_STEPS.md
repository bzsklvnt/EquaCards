# Következő lépések — a PROJECT_REVIEW.md alapján

A `PROJECT_REVIEW.md` szerint a teljes eredeti MVP (0–6. fázis, a review saját számozása) funkcionálisan kész és élesben fut a `claude/pub-kviz-app-setup-q9uje2` branch-en, de **még soha nem futott valós böngészőben**, és van néhány, a tervben szereplő, de meg nem épített admin felület. Ez a dokumentum ezeket a hiányokat bontja kis, önálló Claude Code fázisokra, a `docs/architecture/DATA_MODEL.md` és `docs/design/STYLE_GUIDE.html` már meglévő konvencióit követve.

---

## 0. Elsőbbségi sorrend

1. **Böngészős smoke-teszt + PR megnyitása** — ez nem kódolás, hanem verifikáció. A review §8-ban ez az #1 javaslat, és van rá jó okuk (a slider-bug példa). Ezt érdemes **most, a screen-fejlesztés előtt vagy azzal párhuzamosan** elvégezni, ne halogasd a lista végéig.
2. **UI/UX fázisok (F–J)** — header, reszponzivitás, navigáció, komponens-konzisztencia, játékélmény. Ezeket érdemes **előbb** végigvinni, mert a lenti admin-hézag fázisok (B–D) új felületeket hoznak létre, amiknek jobb, ha már egy kész layout-vázba kell csak beilleszkedniük, nem utólag kell őket egységesíteni.
3. **Fázis K–L** — vizuális QA a jóváhagyott `STYLE_GUIDE.html` ellen + a visszaszámláló timer véglegesítése. Ez a lépés zárja le ténylegesen a "megépült-e, amit terveztünk" kérdést — F–J-vel megépült a keret, K–L-lel ellenőrizzük, hogy pontosan azt kaptuk, amit jóváhagytunk.
4. Utána jöhetnek a admin-hézag fázisok (B–D) és a font-betöltés javítás (E) — ezek egymástól függetlenek, bármilyen sorrendben végezhetők.
5. **Fázis M — MVP indítási checklist** — ez az utolsó lépés, miután minden más kész: favicon, hibaoldalak, PIN brute-force védelem, manifest, és egy végső kereszt-ellenőrzés a teljes DATA_MODEL.md ellen, hogy tényleg nincs-e kimaradt darab.

---

## 1. Böngészős smoke-teszt (nem Claude Code fázis — ezt neked kell megnyomnod)

```
1. Deployold a branch-et Vercel preview-ként (ez a sandbox proxyján kívül fut, el kell érnie a Supabase-t).
2. Nyisd meg /admin, jelentkezz be a levbozsoki@gmail.com super_admin fiókkal.
3. Hozz létre 1-2 tesztkérdést mind az 5 típusból (a review külön kiemeli a slider-t, mivel ott volt a bug).
4. Indíts egy játékot, csatlakozz 2-3 böngészőfüllel csapatként, fuss végig egy teljes körön.
5. Nyisd meg /tv/[game_id]-t egy negyedik fülön, nézd meg él-e a realtime szinkron.
6. Ha mindent rendben találtál: nyisd meg a PR-t a claude/pub-kviz-app-setup-q9uje2 → main között.
```

---

## 2. Fázis F — Globális layout héj: header + navigáció, felületenként

**Miért kell:** a `DATA_MODEL.md` §7 négy felületet ír le eltérő célokkal, de eddig nem született döntés a közös/eltérő layout-keretről. Ez az alap, amire minden további UI-fázis épül.

```
A docs/architecture/DATA_MODEL.md 7. szakasza alapján építs egy-egy layout héjat
(+layout.svelte) mind a négy felülethez, egymástól eltérő célra szabva:

- /admin: perzisztens header + oldalsáv navigáció (Kérdésbank, Témák, Vizuális
  témák, Felhasználók, Beállítások, Riportok linkek — azokra is mutasson, amik
  még nem készültek el, ne törjön a link, csak legyen üres/placeholder oldal).
  Mobilon az oldalsáv hamburger-menübe csukódjon.
- /host/[game_id]: minimális header — este címe, PIN, kör/kérdés progress
  (pl. "3. kör · 4/8 kérdés"), kapcsolat-állapot indikátor (Supabase realtime
  connected/reconnecting), "Kilépés" link admin-ba. Nincs teli navigáció.
- /play/[pin]: NINCS header, vagy csak egy vékony csík a csapatnévvel és a
  jokerrel — a mobil képernyő minden pixelje a kérdésé.
- /tv/[game_id]: NINCS semmilyen header/chrome, teljes képernyős, immerzív.

Minden header/nav a Fázis 3-ban létrehozott komponens-könyvtárból építkezzen
(Button variánsok stb.), CSS változókból (var(--cyan) stb.), sose hardcode-olt
színekkel.

A végén dokumentáld a docs/architecture/DESIGN_SYSTEM.md-ben a négy layout
héj eltérő elveit, és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 3. Fázis G — Reszponzív design audit és finomítás

**Miért kell:** a review nem tesztelte böngészőben (§2) — a reszponzivitás pontosan az a fajta dolog, amit sem a típusellenőrző, sem az SQL-szimuláció nem vesz észre.

```
Menj végig mind a négy felületen (docs/architecture/DATA_MODEL.md 7. szakasza)
és ellenőrizd/javítsd a töréspontokat:

- /play/[pin]: mobile-first, 360px-től induljon tisztán (a legkisebb elterjedt
  telefon-szélesség), a válasz-gombok legyenek elég nagyok érintéshez
  (minimum ~44x44px), a csúszka (slider) és a drag-and-drop sorrendezés
  külön ellenőrizendő kis képernyőn.
- /host/[game_id]: tablet és desktop méretre optimalizálva (a host valószínűleg
  laptopon vagy tableten kezeli), de ne törjön el egy kisebb laptop képernyőn sem.
- /admin: desktop-first (adatbeviteli munka), de az oldalsáv (Fázis F) csukódjon
  össze mobilon/tableten használhatóan.
- /tv/[game_id]: nagy kijelzőre optimalizált tipográfia-méretezés (a Press
  Start 2P és Silkscreen fontok olvashatósága 3-5 méteres távolságból), teszteld
  legalább 1920x1080-as felbontáson.

Használj CSS clamp()-et a fluid tipográfiához ahol értelmes, ahelyett hogy
sok egyedi media query-t írnál egy-egy betűmérethez.

A végén frissítsd a docs/architecture/DESIGN_SYSTEM.md-t a törésponti
konvenciókkal (pl. mobil <640px, tablet <1024px, desktop ennél nagyobb),
és a docs/DECISIONS_LOG.md-t.
```

---

## 4. Fázis H — Komponens-konzisztencia audit

**Miért kell:** 6 fázison át (0–6, a review saját számozása) épült a felület — valószínű, hogy közben született ad-hoc gomb/kártya, ami nem a Fázis 3-ban létrehozott komponens-könyvtárat használja.

```
Nézd át mind a négy felület kódját, és keress minden helyet, ahol egy gomb,
kártya, badge vagy input NEM a Fázis 3 komponens-könyvtárából (Button,
ChoiceButton, TimerRing, PinDisplay, TeamChip, PodiumCard) épül, hanem
egyedi, ad-hoc stílusú elem. Cseréld le ezeket a megosztott komponensekre,
vagy — ha a komponens-könyvtárból hiányzik egy szükséges variáns (pl. egy
"veszély" színű gomb megerősítő dialógushoz) — bővítsd a könyvtárat, ne
hozz létre újabb egyedi elemet mellette.

Külön nézd meg az űrlap-elemeket (input, select, checkbox, radio) — ha még
nincs rájuk egységes stílus a design rendszerben, hozz létre alap Input/Select/
Checkbox komponenseket ugyanabban a mintában, mint a Button.

A végén frissítsd a docs/architecture/DESIGN_SYSTEM.md komponens-listáját
a bővítésekkel, és a docs/DECISIONS_LOG.md-t.
```

---

## 5. Fázis I — Játékélmény polírozás

**Miért kell:** a review 2. szakasza kifejezetten megemlíti, hogy a Fázis 6-ban hozzáadott átmenetek/animációk soha nem futottak valós böngészőben — ez az a fázis, ahol ezeket ténylegesen finomítjuk, kiegészítjük, és lefedjük a hiányzó állapotokat (üres, hiba, betöltés).

```
A docs/design/STYLE_GUIDE.html és a docs/architecture/DATA_MODEL.md 5.
szakasza (real-time protokoll) alapján:

1. Ellenőrizd/finomítsd a kérdés-váltás és a reveal átmeneteket Svelte
   transitions-szel (fade/fly a question_show és question_reveal eseményeknél).
2. Adj ünneplő animációt a kör-végi/végső top 3 reveal-hez (round_leaderboard_reveal,
   final_leaderboard_reveal) — használd a canvas-confetti csomagot (kicsi,
   függőségmentes, nem kell saját konfetti-rendszert építeni), csak az 1. helyre
   kerülő csapatnál süljön el.
3. Építs be egy "újracsatlakozás" állapotot a /play és /tv felületen, ha a
   Supabase realtime kapcsolat megszakad (pl. "Kapcsolat helyreállítása..."
   overlay, a TimerRing komponens szürke/inaktív变ánsával).
4. Adj üres állapotokat, ahol eddig hiányoztak: kérdésbank szűrő 0 találattal,
   lobby 0 csatlakozott csapattal, riport oldal 0 lezárt estével.
5. Adj betöltés-állapotokat (skeleton vagy egyszerű spinner a Fázis 3
   komponens-könyvtár stílusában) minden aszinkron adatlekérésnél, ahol eddig
   villanás/üres tartalom volt látható rövid ideig.

A végén dokumentáld a docs/features/game-experience-polish.md-ben a hozzáadott
állapotokat/animációkat, és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 6. Fázis J — Akadálymentesség és kontraszt átvizsgálás

**Miért kell:** a retro arcade paletta (neon színek sötét háttéren) esztétikailag erős, de kontraszt szempontból nem garantált, hogy minden szövegszín/háttér-pár megfelel — ezt érdemes tudatosan ellenőrizni, nem véletlenre bízni.

```
Fuss le egy Lighthouse/axe accessibility ellenőrzést mind a négy felületen
(ez böngésző dev tool, nem igényel új csomagot). Ahol a --marquee-dim
másodlagos szöveg vagy egy neon akcent szín a --cabinet háttéren nem éri el
a WCAG AA kontraszt-arányt (4.5:1 normál szövegnél, 3:1 nagy szövegnél/UI
elemeknél), finomíts a design_themes seed tokenjein (docs/architecture/
DATA_MODEL.md 8. szakasz) vagy adj hozzá egy sötétebb/világosabb variánst
adott kontextushoz.

Ellenőrizd/adj hozzá látható fókusz-állapotot (outline vagy box-shadow
var(--cyan)-nal) minden interaktív elemre billentyűzetes navigációhoz —
a jelenlegi retro-panel design könnyen "eltünteti" az alapértelmezett
böngésző fókusz-gyűrűt, ezt explicit pótolni kell.

Ellenőrizd a /play felület érintési célpontjait (min. ~44x44px minden
válasz-gombnál, a joker gombnál, a csúszka thumb-nál).

A végén dokumentáld a docs/architecture/DESIGN_SYSTEM.md-ben a kontraszt-
és fókusz-konvenciókat, és a docs/DECISIONS_LOG.md-t.
```

---

## 7. Fázis K — Vizuális QA a jóváhagyott STYLE_GUIDE.html alapján

**Miért kell:** F–J fázisokban megépült/finomodott a keret, de sosem volt egy explicit lépés, ami tételesen összeveti a végeredményt a jóváhagyott referenciával — könnyen becsúszhat apró eltérés (rossz font egy helyen, hiányzó neon-keret egy kártyán), amit senki nem vesz észre, amíg nincs oda nézve.

```
Nyisd meg a docs/design/STYLE_GUIDE.html-t és hasonlítsd össze tételesen a
tényleges /admin, /host, /play, /tv felületekkel. Minden eltérést jegyezz fel
és javíts:

- Színhasználat: var(--cyan) az elsődleges interaktív elemeken, var(--power)
  a helyes válasznál, var(--danger) a helytelennél/sürgető timernél,
  var(--coin) a pontszám/PIN kiemeléseknél, var(--magenta) a jokernél —
  mindenhol pontosan ezt a szerep-hozzárendelést kövesse, ne keveredjenek.
- Tipográfia: Press Start 2P csak rövid címekhez/kérdésekhez (nem hosszú
  prózára), Silkscreen minden szám-jellegű kijelzésen (timer, pontszám,
  PIN), Inter mindenhol máshol (gombszöveg, leírások).
- A "arcade panel" neon-keret + scanline-textúra konzisztens alkalmazása
  minden kártyaszerű elemen (kérdés-kártya, ranglista-kártya, PIN/QR panel).
- A joker gomb, PodiumCard (dobogó), TeamChip és ChoiceButton komponensek
  pontosan a STYLE_GUIDE.html mintáit követik-e, nem egy közben elkanyarodott
  variánst.

A végén dokumentáld a docs/architecture/DESIGN_SYSTEM.md-ben, ha bármilyen
tudatos eltérést hagytál a STYLE_GUIDE.html-hez képest (pl. UX okból), és
frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 8. Fázis L — Visszaszámláló timer véglegesítése

**Miért kell:** a review nem tesztelte böngészőben a realtime időzítést (§2: "does the countdown actually feel synced across 3 phones and a TV?") — ez explicit kockázat, amit érdemes külön, célzottan lezárni, nem csak remélni hogy jó.

```
A docs/architecture/DATA_MODEL.md 5. szakasza (real-time protokoll) és a
STYLE_GUIDE.html "timer-ring" komponense alapján ellenőrizd/fejezd be a
visszaszámláló implementációt mindhárom releváns felületen (/host, /play, /tv):

1. A timer_start broadcast egyszer küldi a server_start_time-ot és a
   duration-t — minden kliens ebből számol lokálisan, NEM kap
   másodpercenkénti broadcast-ot. Ellenőrizd, hogy tényleg így van.
2. A TimerRing komponens színt váltson: nyugodt cián (sok idő van hátra) →
   pulzáló narancs (kevés idő van hátra, pl. az utolsó 5 másodpercben),
   pontosan a STYLE_GUIDE.html full/low állapot-mintája szerint.
3. A válasz beküldését a szerver oldalon (evaluate_answer RPC) ellenőrizd,
   hogy a duration-on belül történt-e — kliens-oldali óra manipulációja
   ne tudjon extra időt "lopni".
4. Az answer_locked esemény pontosan a timer lejártakor váltsa ki az input
   letiltását minden csapatnál, még akkor is, ha valaki nem nézte a
   visszaszámlálót.
5. Teszteld kézzel, hogy a timer /host, /play és /tv nézeteken vizuálisan
   szinkronban fut (nem kell 100%-ra pontosnak lennie, de ne legyen
   másodperces csúszás 2-3 böngészőfül között).

A végén dokumentáld egy docs/features/timer.md-ben a végleges
timer-mechanizmust, és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 9. Fázis B — Admin: Felhasználó- és jogosultságkezelő UI (`/admin/users`)

**Miért kell:** jelenleg minden role-váltás kézi SQL (`update profiles set role_id = ...`) — ez a review #1 admin-hézaga, és ez a leginkább hiba-veszélyes kézi művelet (elgépelt UUID, rossz role_id).

```
Hozd létre a /admin/users route-ot, csak super_admin-nak elérhetően (role_id = 1
guard, ugyanaz a minta, mint a többi admin route-nál). Illeszd be a Fázis F-ben
létrehozott admin layout héjba (oldalsáv nav "Felhasználók" linkje innentől
tényleges oldalra mutat).

Listázd a profiles táblát (display_name, email a auth.users join-ból, jelenlegi
role_id), egy dropdown-nal role-onként, amivel egy super_admin módosíthatja
bárki role_id-ját. Minden módosítás a meglévő audit trigger-en (log_table_change,
Fázis 1) keresztül automatikusan naplózódik — nincs extra teendő hozzá.

Csomag-ajánlás: használj sveltekit-superforms + zod-ot a role-váltó form
kezeléséhez (validáció, hibaüzenetek, optimista UI) — ez a SvelteKit ökoszisztéma
bevett, karbantartható mintája, kevesebb kézzel írt boilerplate-et jelent, mint
egy sima <form> + saját state-kezelés.

Adj hozzá egy egyszerű toast visszajelzést sikeres role-váltásnál (pl.
svelte-french-toast, könnyű csomag, nem igényel saját toast-rendszer építést).

A végén dokumentáld a docs/features/user-management.md-ben a role-váltás
folyamatát, és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 10. Fázis C — Admin: Globális beállítások UI (`/admin/settings`)

**Miért kell:** az `app_settings` tábla (pl. `question_reuse_cooldown_months`) jelenleg csak SQL-lel szerkeszthető — a review #2 admin-hézaga.

```
Hozd létre a /admin/settings route-ot, csak super_admin-nak (role_id = 1 guard).
Illeszd be a Fázis F admin layout héjba.

Listázd az app_settings táblát kulcs-érték párokként, generikus szerkesztő
formmal: a value jsonb mezőt a kulcs alapján megfelelő input-típussal jelenítsd
meg (a question_reuse_cooldown_months-nál pl. number input hónap egységgel).
Ne hardcode-old a kulcsok listáját a UI-ba — olvasd ki a táblából, hogy új
beállítás hozzáadása (pl. jövőbeli app_settings insert) automatikusan megjelenjen
admin szerkesztő nélkül is.

Ugyanazt a sveltekit-superforms + zod mintát használd, mint Fázis B-ben, a
konzisztencia miatt.

A végén dokumentáld a docs/features/app-settings.md-ben, hogy melyik kulcs mit
csinál, és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 11. Fázis D — Viewer statisztika/riport felület

**Miért kell:** a `viewer` role létezik a sémában (és ez az alapértelmezett minden új regisztrációnak!), de nincs semmi, amit láthatna — a review #3 admin-hézaga.

```
Hozd létre a /reports route-ot, viewer/admin/super_admin/host role-oknak
elérhetően (role_id in (1,2,3,4)). Illeszd be a Fázis F admin layout héjba.

Listázd a lezárt (status = 'finished') games sorokat dátum szerint csökkenő
sorrendben. Kattintva egy estére mutasd meg a final_leaderboard adatait
(teams + total_score), és pár egyszerű aggregált statisztikát: leggyakrabban
használt design/tartalmi témák, átlagos csapatszám esténként, leggyorsabb
válaszidők kérdéstípusonként.

Csomag-ajánlás: Chart.js-t használj az aggregált statisztikákhoz (oszlopdiagram
a témagyakorisághoz, vonaldiagram a csapatszám trendhez esténként) — ne építs
saját SVG-chart komponenst, a Chart.js jól bevált, könnyen karbantartható erre
a méretre.

A végén dokumentáld a docs/features/reports.md-ben a megjelenített metrikákat,
és frissítsd a docs/DECISIONS_LOG.md-t.
```

---

## 12. Fázis E — Design téma dinamikus font-betöltés (a review 6. szakaszában jelzett hiányosság javítása)

**Miért kell:** jelenleg csak a seedelt "Retro Arcade" téma 3 fontja van belinkelve az `app.html`-ben — egy admin által létrehozott új design téma más fonttal csendben a böngésző alapértelmezettjére esik vissza.

```
A docs/architecture/DATA_MODEL.md 8. szakasza alapján bővítsd a
src/lib/theme/tokens.ts getActiveTokens()-jét (vagy egy hozzá tartozó
loadThemeFonts() függvényt), ami a design_tokens font_display/font_led/
font_body kulcsaiból dinamikusan épít egy Google Fonts <link> URL-t, és
futásidőben injektálja a <head>-be (ha még nincs betöltve az adott font).

Adj hozzá egy egyszerű fallback-et: ha egy font betöltése sikertelen (pl.
elgépelt névvel), a UI ne törjön, csak essen vissza a böngésző alap
sans-serif/monospace-ára.

Teszteld úgy, hogy létrehozol egy második design témát eltérő fontokkal az
admin felületen, és ellenőrzöd, hogy tényleg betöltődik-e váltáskor.

A végén frissítsd a docs/architecture/DESIGN_SYSTEM.md-t ezzel a mechanizmussal,
és a docs/DECISIONS_LOG.md-t.
```

---

---

## 13. Fázis M — MVP indítási checklist (utolsó lépés, miután minden más kész)

**Miért kell:** minden korábbi fázis egy-egy konkrét hiányt vagy funkciót céloz meg — ez a fázis az összegző "tényleg készen állunk-e egy éles kvízestére" ellenőrzés, olyan apróságokkal, amik önmagukban egyik korábbi fázisba sem illettek bele tisztán, de MVP-indításhoz mind kellenek.

```
Ez egy összegző, "launch readiness" fázis — menj végig az alábbi listán, és
oldj meg mindent, ami még hiányzik:

1. Favicon + oldal-címek: adj egy retro-arcade stílusú favicon-t (a
   STYLE_GUIDE.html színeivel/formáival illő egyszerű ikon) és értelmes
   <title>-eket minden route-hoz (pl. "Sör Barátok | Kocsmai Kvíz", ne az
   alapértelmezett "SvelteKit App" jelenjen meg a böngésző fülön).

2. 404 és általános hibaoldal: legyen a design rendszerhez illő (arcade
   panel, retro tipográfia), ne a SvelteKit alapértelmezett fehér hibaoldal
   jelenjen meg soha egy éles esten.

3. PIN brute-force védelem: a 6 jegyű PIN ~900,000 kombináció — adj egy
   egyszerű rate-limitet a /play csatlakozási endpoint-ra (pl. egy Supabase
   Edge Function vagy egy egyszerű IP/device-alapú számláló percenkénti
   próbálkozás-korláttal), hogy valaki ne tudjon script-tel PIN-eket
   próbálgatva idegen esti játékba bejutni.

4. manifest.json a /play felülethez: hogy "Kezdőképernyőhöz adás" opcióval
   telefonon appszerűen nyitható legyen ismétlődő heti kvízestékhez —
   egyszerű statikus manifest, retro arcade ikonnal.

5. Végső kereszt-ellenőrzés a docs/architecture/DATA_MODEL.md ellen: menj
   végig minden szakaszon (1–9), és listázd ki, ha bármi a tervben szerepel,
   de nincs UI-lefedettsége — ne feltételezz, ellenőrizd ténylegesen a
   route-okat/komponenseket a fájlrendszerben.

6. Ellenőrizd, hogy minden .env változó (PUBLIC_SUPABASE_URL,
   PUBLIC_SUPABASE_ANON_KEY/PUBLISHABLE_KEY, SUPABASE_SECRET_KEY) helyesen
   van-e beállítva Production, Preview ÉS Development környezetben Vercelen
   (ez korábban már okozott 500-as hibát élesben).

A végén írj egy összefoglaló "MVP KÉSZ" bejegyzést a docs/DECISIONS_LOG.md-be,
felsorolva, ha bármi a checklistából szándékosan kimaradt, és miért.
```

---

## Csomag-összefoglaló (mind a fenti fázisokhoz)

| Csomag | Mire | Miért ez, nem saját megoldás |
|---|---|---|
| `sveltekit-superforms` + `zod` | Admin form-ok (Fázis B, C) | Bevett SvelteKit minta, validáció + hibakezelés dobozból, kevesebb boilerplate |
| `svelte-french-toast` | Admin akció-visszajelzések | Könnyű, nem igényel saját toast-rendszer építést |
| `chart.js` | Riport diagramok (Fázis D) | Már ismerős eszköz nálad más projektekből, jól karbantartható |
| `canvas-confetti` | Kör-végi/végső top 3 ünneplés (Fázis I) | Kicsi, függőségmentes, nem kell saját konfetti-rendszert építeni |

---

## Amit szándékosan nem teszek be ebbe a listába

A review 6. szakasza (Deliberate scope cuts) néhány dolgot tudatos kompromisszumként azonosít — ezeket **nem** javaslom most megoldani, mert nem blokkolják a hobbi-szintű használatot:
- `evaluate_answer` RPC-ként, nem Edge Function-ként — funkcionálisan egyenértékű, csak akkor kellene portolni, ha valaha külső webhookként kellene hívni
- Csapat-azonosítás `localStorage` tokennel, nem valódi auth — rendben van 40 fős, baráti közegben, nem lenne rendben pénzes/ellenséges környezetben
- TV mód auth nélkül — a UUID nem kitalálható, és nincs rajta érzékeny adat
- Automata tesztelés (Playwright) — egyelőre kivéve a tervből, kérésre később visszakerülhet

Ha ezek közül bármelyik mégis felmerül igényként (pl. publikus, ismeretlenek előtti eseményekhez), szólj, és beillesztjük egy külön fázisként.
