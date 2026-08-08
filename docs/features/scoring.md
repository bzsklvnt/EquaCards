# Pontszámítás + ranglista

## Cél

A `docs/architecture/DATA_MODEL.md` 3. szakaszában leírt "Pontszámítás a két
szorzóval kombinálva" képlet lezárja a Fázis 4-ben beszúrt, de kiértékeletlen
`answers` sorokat: kitölti az `is_correct`/`points_awarded` mezőket, és
hozzáadja az eredményt a csapat `teams.total_score`-jához. Ez a dokumentum a
tényleges implementációt írja le.

## Edge Function helyett Postgres RPC — miért

A DATA_MODEL.md eredetileg egy `evaluate_answer` **Edge Function**-t irányzott
elő erre a célra. A tényleges implementáció (`evaluate_question`) egy
`security definer` Postgres RPC függvény lett helyette. Indoklás:

- Ebben a sandboxban a kimenő HTTPS a `*.supabase.co` felé policy-szinten
  blokkolt — egy ténylegesen deployolt Edge Function-t sem böngészőből
  meghívni, sem közvetlenül HTTP-vel tesztelni nem lehetett volna, csak
  "vakon" deployolni.
- Egy RPC függvény ugyanakkor a már bevált `execute_sql` + `set role`
  mintával (lásd Fázis 3/4) teljes körűen tesztelhető: staff/anon
  jogosultsági határ, a képlet minden ága (mind a 4 kérdéstípus, decay,
  `points_multiplier`, joker-szorzó, parciális `multi_choice` pont),
  idempotencia — mind SQL-lel, seed-elt teszt-fixture-ökkel igazolva, nem
  csak kódolvasással feltételezve.
- Funkcionálisan egyenértékű: a host kliense ugyanúgy egyetlen hívással
  (`data.supabase.rpc('evaluate_question', ...)`) indítja, a hívó oldalon
  nincs érzékelhető különbség egy Edge Function-höz képest.
- Nincs hidegindítási késleltetés, nincs külön deploy-lépés a migrációtól
  elválasztva.

Ha a jövőben mégis szükség lenne rá (pl. külső payment/webhook integrációhoz,
ami valódi HTTP endpointot igényel), a logika könnyen átemelhető egy Edge
Function-be — a képlet maga nem függ a hordozó rétegtől.

## `evaluate_question(p_question_id uuid)`

- `security definer`, csak `authenticated` + `role_id in (1,2,3)` hívhatja
  (staff — host/admin/super_admin); `anon`-tól és `public`-tól explicit
  revoke-olva az EXECUTE.
- Csak azokat az `answers` sorokat dolgozza fel egy kérdésre, ahol
  `is_correct is null` — tehát **idempotens**: kétszeri (pl. a host véletlen
  dupla kattintása miatti) meghívás a második körben nem csinál semmit, nem
  duplázza a `teams.total_score`-t.
- Típusonkénti kiértékelés a DATA_MODEL.md 3. szakasz táblázata szerint:
  - `single_choice` / `true_false`: `answer_choice` → `question_choice_options.is_correct`.
  - `multi_choice`: a 3 fokozatú szabály (rossz jelölés → 0; mind eltalálva →
    1; részleges, jelölési hiba nélkül → arányos) — `arány`-ként számolva,
    `is_correct = true` csak `arány = 1`-nél.
  - `slider`: `abs(value - correct_value) <= tolerance`.
  - `ordering`: minden beküldött pozíció egyezik a helyessel, ÉS van
    legalább egy beküldött sor (üres beküldés ne számítson "helyesnek" egy
    vacuously-true NOT EXISTS miatt).
- **Decay szorzó — dokumentált döntés:** a DATA_MODEL.md nem rögzítette a
  pontos képletet, csak hogy `points_decay = true` esetén van időalapú
  csökkenés. Itt bevezetett szabály: **lineáris decay 100%-ról (azonnali
  válasz) 50%-ra (a `time_limit_seconds` lejártakor)**, utána 50%-on
  plafonozva — tehát a leglassabb, még időben beérkező válasz is legalább az
  alap pontszám felét éri. `points_decay = false` esetén nincs csökkenés,
  a válaszidőtől függetlenül.
- **Végső képlet:**
  ```
  alap_pont     = points * decay_szorzó * arány   -- arány: 1 vagy 0 minden
                                                       típusnál, kivéve multi_choice,
                                                       ahol a 3 fokozatú szabály eredménye
  kérdés_szorzó = questions.points_multiplier
  joker_szorzó  = 2, ha a csapat használt jokert erre a question_id-ra, egyébként 1

  points_awarded = round(alap_pont * kérdés_szorzó * joker_szorzó)
  ```
- Minden feldolgozott `answers` sorra: `update answers set is_correct = ...,
points_awarded = ...`, majd `update teams set total_score = total_score +
points_awarded`.

## `team_answer_result(p_team_id uuid, p_question_id uuid)`

A csapat kliense ebből kérdezi le a **saját** `(is_correct, points_awarded)`
párját egy adott kérdésre, a `question_reveal` broadcast beérkezésekor. Nem
sima anon SELECT policy az `answers`-en, hanem RPC — indoklás: egy `using`
policy nem tud a lekérdezés WHERE-jében megadott `team_id`-hoz kötni (nincs
auth session/JWT, amiből a "saját" `team_id` RLS-szinten kiderülne). Egy anon
SELECT policy tehát vagy semmit nem engedne, vagy `game_id` alapján az ÖSSZES
csapat válaszát kiadná annak, aki a saját (ismerten legitim) `game_id`-jával
kérdez — ez sokkal durvábban sértené a section 5 tervezési elvét ("senki se
lásson mást, csak a sajátját"), mint ez a függvény.

A függvény paraméterezve van `team_id` + `question_id` UUID-párral, és
egyetlen sort ad vissza — ugyanaz az "ismert UUID = de facto tulajdonjog"
minta, mint a `team_joker_uses_select_anon` policy-nál (Fázis 4): egy
technikailag hozzáértő felhasználó, aki ismeri (vagy kitalálja) egy másik
csapat UUID-ját, elméletileg lekérdezhetné annak pontját is. Ez a projekt már
korábban elfogadott biztonsági szintje ("nem bank-app biztonság" egy
40 fős pubkvíz estére), nem új kompromisszum.

## `round_leaderboard(p_round_id uuid, p_limit int default 3)`

Staff-only (`role_id in (1,2,3)`) aggregáló lekérdezés — a DATA_MODEL.md 5.
szakasz SQL mintáját követi, de `teams`-ből indulva (nem `answers`-ből) `left
join`-nal, hogy a 0 pontos vagy egyáltalán nem válaszoló csapatok is
szerepeljenek az összesítésben (a döntetlenek/utolsó helyek korrekt
kezeléséhez — MVP méretben ez nem teljesítmény kérdés).

A **teljes** végeredményhez (`final_leaderboard_reveal`) nem kellett külön
RPC — a host kliens egyszerűen lekérdezi a `teams.total_score`-t
`order by total_score desc`-vel, mivel az `evaluate_question` már
folyamatosan karbantartja azt kérdésenként.

## Host vezérlés

`/host/[game_id]` `revealAnswer()`-je a helyes válasz szövegének
összeállítása előtt meghívja az `evaluate_question` RPC-t. Egy kör utolsó
kérdésének feltárása után a "Következő kérdés" gomb helyén "Kör
eredményének feltárása" jelenik meg (`revealRoundLeaderboard()` — lekéri a
`round_leaderboard`-ot, broadcastolja a `round_leaderboard_reveal`-t, majd egy
`round_summary` UI lépésben a hostnak is megjeleníti); az utolsó kör után
"Végeredmény feltárása" (`revealFinalLeaderboard()` — hasonlóan, de a teljes
`teams` listával, `final_leaderboard_reveal` eseménnyel). Csak ezután
kattintható a tényleges "Következő kör"/"Játék lezárása" gomb.

## Csapat felület

`/play/[pin]` a `question_reveal` beérkezésekor lekéri a saját pontját
(`team_answer_result`), és zöld/piros felirattal jelzi, hogy a beküldött
válasz teljesen helyes volt-e, illetve mennyi pontot ért. A
`round_leaderboard_reveal`/`final_leaderboard_reveal` beérkezésekor egy
teljes képernyős ranglista-nézetre vált (a saját csapat kiemelve), amíg a
következő kérdés (`question_show`) újra el nem tünteti.

## TV felület — elhalasztva Fázis 6-ra

A `docs/architecture/DATA_MODEL.md` 9. szakasza szerint a `/tv/[game_id]`
kivetítő felület ("TV mód nagy kijelzőre") kifejezetten Fázis 6
("Polírozás") scope-ja, nem Fázis 5-é. A `round_leaderboard_reveal`/
`final_leaderboard_reveal` broadcast események már most is olyan alakúak,
hogy egy jövőbeli TV kliens minden külön backend-módosítás nélkül
feliratkozhat rájuk — csak a read-only megjelenítő route hiányzik még.
