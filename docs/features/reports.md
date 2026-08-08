# Riportok (`/reports`)

## Cél

A review #3 admin-hézaga: a `viewer` role létezik a sémában (és ez az
alapértelmezett minden új regisztrációnak), de eddig nem volt semmi,
amit láthatna. Ez a dokumentum a `/reports` felületet és a mögötte lévő
adatlekérdezési réteget írja le.

## Hozzáférés

`role_id in (1,2,3,4)` — minden authentikált szerepkör, a `/admin`
sidebar-tól **függetlenül** (a `/reports` nem az `/admin` layout alatt
él a route-fában, mert a `viewer`-nek nincs `/admin` hozzáférése
egyáltalán — saját, önálló `main.cabinet` témázással rendelkezik, mint a
`/login`/`/`).

## Miért RPC-k, nem közvetlen tábla-SELECT

Menet közben kiderült, hogy a `viewer` szerepkörnek **egyetlen SELECT
policy-ja sem volt** a `games`/`teams`/`questions`/`themes`/
`design_themes`/`question_types`/`round_questions`/`rounds`/`answers`
táblák egyikén sem — az `/reports` implementációja nélkül a viewer
gyakorlatilag semmit nem tudott volna lekérdezni, függetlenül a UI-tól.
Ahelyett, hogy kiszélesítettük volna ezeknek a tábláknak a nyers RLS-ét
`role_id=4`-re (ami a riport által ténylegesen megjelenített adatnál
jóval többet adna ki közvetlen táblahozzáférésként), öt szűk, konkrét
célú `security definer` RPC-t vezettünk be — ugyanaz a minta, mint a
`round_leaderboard`/`team_answer_result`-nál (Fázis 5). Mindegyik a
függvény törzsében explicit ellenőrzi, hogy a hívó `current_user_role_id()`-ja
`(1,2,3,4)` egyike, mielőtt bármit visszaadna.

| RPC                                   | Visszaadja                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `reports_finished_games()`            | Lezárult esték: `id`, `title`, `finished_at`, `team_count` (dátum szerint csökkenő)      |
| `reports_game_leaderboard(game_id)`   | Egy konkrét lezárult este csapat-végeredménye (`name`, `total_score`, pontszám szerint)  |
| `reports_design_theme_usage()`        | Vizuális témák használati gyakorisága lezárult esték között                              |
| `reports_content_theme_usage()`       | Tartalmi témák (kérdésbank `themes`) használati gyakorisága lezárult esték kérdései közt |
| `reports_avg_response_time_by_type()` | Átlagos válaszidő (mp) kérdéstípusonként, lezárult esték válaszai alapján                |

**Nincs külön "átlagos csapatszám" RPC** — a `reports_finished_games()`
már visszaadja a csapatszámot esténként (`team_count`), ami a
vonaldiagram trendjéhez is kell; az átlag ugyanebből az adatból
kliens-oldalon triviálisan számolható, nem éri meg egy külön RPC kört
érte (ez menet közben derült ki: eredetileg épült egy
`reports_avg_team_count()` RPC is, de feleslegesnek bizonyult és
törölve lett, mielőtt a repóba került volna).

## Módszertani felfedezés: az anon-grant csapda

A `revoke execute ... from public` **önmagában nem** veszi el az
`anon`/`authenticated` szerepkörök alapértelmezett EXECUTE jogát ezen a
projekten. Élőben leellenőrizve (`set role anon` egy `rollback`-kal
lezárt tranzakcióban): enélkül a lépés nélkül `anon` ténylegesen le
tudta futtatni a `reports_finished_games()`-t és **valós adatot kapott
vissza**, annak ellenére, hogy a függvény törzse explicit
`current_user_role_id() not in (...)` ellenőrzést tartalmazott — ez a
belső ellenőrzés `NULL` `role_id`-nál (anon esetén, akinek nincs
`profiles` sora) nem sül el, mert `NULL not in (...)` SQL-ben `NULL`
eredményt ad, nem `true`-t, egy `if NULL then` pedig nem lép be az
ágba. A helyes, már a `scoring.sql`-ben (Fázis 5) bevált minta mindkét
explicit revoke-ot igényli: `revoke ... from public` **és**
`revoke ... from anon, authenticated`, mielőtt a tényleges `grant`
kiadásra kerülne. Ez minden jövőbeli RPC-re érvényes tanulság, nem csak
erre a fázisra — lásd `docs/architecture/DATA_MODEL.md` 4. szakasz
"Implementáció (Fázis D)".

## UI

- **`/reports`**: aggregált statisztikák (lezárult esték száma, átlagos
  csapatszám, vonaldiagram a csapatszám-trendről esténként, oszlopdiagram
  a vizuális és a tartalmi témák használati gyakoriságáról, lista az
  átlagos válaszidőkről kérdéstípusonként) + a lezárult esték listája,
  dátum szerint csökkenő sorrendben.
- **`/reports/[game_id]`**: egy konkrét este végeredménye, `PodiumCard`
  komponensekkel (ugyanaz, mint a `/host`/`/play`/`/tv` ranglista-nézetein).
  A cím/dátum is a `reports_finished_games()`-ből jön (nem külön
  `games` lekérdezésből), mert a viewer szerepkörnek nincs közvetlen
  SELECT joga a `games` táblán.
- **Chart.js** (`chart.js` csomag, nem `svelte-chartjs` wrapper — a
  könyvtár maga keretrendszer-agnosztikus, egy vékony
  `ReportChart.svelte` komponens (`canvas` + `onMount`/`onDestroy`)
  csomagolja be, típus (`bar`/`line`), címkék, adat és a felbontott
  design-token színek (`--cyan`/`--violet`/`--coin`, `--cabinet-3`
  rácsvonal, `--marquee-dim` tengelyszöveg) átadásával.

### Diagram-konfiguráció javítások (Fázis N4)

Élő böngészős teszt két konkrét Chart.js-hibát talált:

- **Törtszám y-tengely egész-szám metrikán:** a csapatszám-trend
  vonaldiagramja alapból törtszám lépésközt (`0.1` stb.) is mutathat,
  holott a csapatszám sosem lehet tört. Az `y` skála mostantól mindig
  `precision: 0`-t kap (kizárja a törtszám-tick-eket), a vonaldiagram
  emellett egy opcionális `yStepSize` prop-on keresztül explicit `1`
  lépésközt is kap — ezt **csak** a csapatszám-trendnél adjuk át
  (kis, ismert tartományú szám), a téma-használati oszlopdiagramoknál
  nem, mert ott nagyobb/ismeretlen tartományú számláló-adat lehet, és a
  fix `stepSize: 1` ott túl sűrű tengelyt adna — a `precision: 0` önmagában
  elég az egész-szám kényszerhez, a lépésköz méretét Chart.js választja.
- **Oszlopdiagram túlcsordulás/hiányzó tengelycímke:** az `x` tengely
  `ticks` mostantól `maxRotation: 45`/`autoSkip: true`-t kap, hogy a
  hosszabb téma-címkék elforduljanak, ne fedjék egymást vagy vágódjanak
  le; a `.chart-wrap` konténer `height: 16rem`-ről `18rem`-re nőtt és
  explicit `width: 100%`/`min-width: 0`-t kapott a defenzív layout
  miatt.

## Elfogadott értelmezési döntés: "leggyorsabb válaszidő" → átlag

A terv szövege "leggyorsabb válaszidők kérdéstípusonként"-t mond, de a
`reports_avg_response_time_by_type()` **átlagot** számol, nem minimumot.
Indoklás: egy nyers minimum (a valaha volt leggyorsabb egyetlen válasz)
egyetlen csapat egyetlen rekordja lenne, könnyen kiugró/nem reprezentatív
érték — az átlag sokkal informatívabb aggregátum arra a kérdésre, hogy
"melyik kérdéstípusra reagálnak gyorsabban a csapatok általában". A UI
és a dokumentáció is explicit "átlagos válaszidő"-ként címkézi, nem
állítja, hogy szó szerint a leggyorsabbat mutatja.
