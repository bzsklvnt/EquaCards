# Részletes eredmény-bontás — kizárólag kezelőfelület (Fázis Q2)

## Cél

Körönkénti/kérdésenkénti bontás, ami megmutatja, melyik csapat mit
válaszolt, helyes volt-e, mennyi pontot kapott, és mennyi idő alatt
válaszolt — a `/admin/games/[id]/results` oldalon, a "Részletes
eredmények" linken keresztül, egy adott kvízeste kezelőoldaláról nyitva.

## Hozzáférés

A route az `/admin` fa alatt van, tehát a `/admin/+layout.server.ts`
guard-ja (`role_id in (1, 2)`) automatikusan érvényesül rá — nincs külön
jogosultság-ellenőrzés a `+page.server.ts`-ben. Ez tudatosan szűkebb, mint
a nyitó leírás "staff role: super_admin/admin/host" megfogalmazása — a
`host` (role_id 3) jelenleg nem éri el az `/admin/games/*` fát (ez a
kódbázisban máshol is így van: a host felület kizárólag a `/host/[game_id]`
élő lebonyolító nézetet használja, sosem az admin kvízeste-CRUD-ot). A DB
RLS-szint (lásd lent) a `host`-ot is beengedné, ha valaha kapna egy saját
belépési pontot ehhez a nézethez — ez a döntés a UI-elérést, nem az RLS-t
szűkíti.

## KRITIKUS biztonsági garanciák

1. **A broadcast eseményekben nincs per-kérdés per-csapat bontás.**
   `RoundLeaderboardRevealPayload`/`FinalLeaderboardRevealPayload`
   (`src/lib/realtime/protocol.ts`) kizárólag `top3`/`standings`
   aggregátumot tartalmaz (`team_id`, `name`, `score`, `rank`) — ez a
   Fázis Q2 auditja szerint változatlan, nem kellett módosítani.
2. **Az `answers` tábla RLS-e** (`answers_staff_all`,
   `supabase/migrations/20260808111917_answers_joker.sql`) — csak
   `role_id in (1, 2, 3)` olvashat/írhat korlátozás nélkül; az `anon`
   szerepkörnek **nincs SELECT policy-ja** ezen a táblán (csak egy szűk
   INSERT). Élőben ellenőrizve (`set local role anon` + rollback-kal lezárt
   tranzakció): `select count(*) from answers` → `0` sor anon-ként, még ha
   a táblában ténylegesen vannak is sorok.
3. **A `question_choice_options`/stb. kérdésbank-táblák** ugyanígy csak
   `role_id in (1,2,3)`-nak olvashatók (`questions_select_staff` és
   testvér policy-i, Fázis 4) — élőben ellenőrizve, `anon`-ként `0` sor.
4. **Nincs paraméter nélküli/anon-elérhető RPC ehhez a nézethez** — a
   `/admin/games/[id]/results/+page.server.ts` NEM egy RPC-t hív, hanem
   közvetlen, RLS-védett táblalekérdezéseket a `+layout.server.ts`-ből már
   authentikált (role 1/2) Supabase klienssel — a route maga a
   jogosultság-ellenőrzés, nincs külön "admin RPC" felület, amit meg
   kellene védeni.

## Implementáció (`+page.server.ts`)

Tömeges (nem N+1) lekérdezésekkel épül fel — egy-egy `select ... in (...)`
hívás körönként/kérdésenkénti helyett a teljes este összes körére/
kérdésére/válaszára egyszerre, aztán JS-oldali csoportosítás/összefésülés:

1. `rounds`, `teams` a este `game_id`-jára.
2. `round_questions` (kérdés + típus join) az összes kör `id`-jára.
3. `question_choice_options`/`question_slider_config`/`question_ordering_items`
   az összes érintett `question_id`-ra (a helyes válasz szövegének
   összeállításához, ugyanazzal a típusonkénti logikával, mint a host
   `revealAnswer()`-je).
4. `answers` az összes érintett `question_id`-ra — ez adja a "ki mit
   válaszolt" bontás gerincét.
5. `answer_choice`/`answer_choice_multi`/`answer_slider`/`answer_ordering`
   az összes érintett `answer_id`-ra — a ténylegesen beküldött válasz
   tartalmának (nem csak helyes/helytelen) megjelenítéséhez.

A végeredmény: kör → kérdés → csapatonkénti sor (beküldött válasz szövege,
helyes-e, pontszám, válaszidő másodpercben).

## UI

`/admin/games/[id]/results/+page.svelte` — körönként egy `.round` panel,
kérdésenként egy táblázat (csapat / beküldött válasz / helyes? / pont /
idő), a Fázis N3 mobil-táblázat mintáját követve (`640px` alatt kártyás
nézet, `thead` elrejtve, `data-label`-ekből generált címkék).
