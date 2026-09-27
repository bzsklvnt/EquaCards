# Kérdések újrajátszása és este másolása

Állapot: **kész** (2026-09-27).

Egy már lejátszott kérdés bármelyik másik estén újra játszható — akár
ugyanazon a héten, akár egyszerre két helyszínen. Egy estén belül egy kérdés
továbbra is csak egyszer szerepelhet (`docs/features/quiz-builder.md`).

## Élő játék estére szűrve

Korábban több helyen a kérdés **összes** korábbi válaszát nézte a rendszer,
ezért egy újra feltett kérdés hibásan viselkedett:

- **Host beküldés-számláló és automatikus lezárás** — csak az aktuális este
  válaszait számolja (`answers.game_id` szűrés, a Realtime feliratkozás is
  estére szűr). Korábban egy újrajátszott kérdésnél azonnal „mindenki
  válaszolt”, és a kérdés rögtön lezárult.
- **Kiértékelés** — `evaluate_question(p_question_id, p_game_id)` és
  `host_reveal(p_question_id, p_game_id)`: a feltárás csak a saját este
  válaszait értékeli, így két párhuzamos este nem zavarja egymást. (A
  `p_game_id` nélküli hívás a régi, kérdés-szintű viselkedést adja.)
- **Állapot-visszatöltés** — a `current_question_state` „feltárva” jelzője és
  a helyes válasz csak az adott este válaszaiból számol.

Migráció: `supabase/migrations/20260927160000_question_reuse.sql`. A
pontszámítás nem változott.

## Pihentetés (globális kapcsoló)

Beállítások › Játék › „Kérdések pihentetése” (`question_reuse_cooldown_months`):

- **0 = nincs pihentetés** (alapérték): minden kérdés korlátlanul, bárhová
  berakható; a random húzás csak az este már szereplő kérdéseit hagyja ki; a
  kvízösszerakó nem figyelmeztet a korábban elhangzott kérdésekre, és a
  kérdésbank-fiók „Csak még nem játszott” szűrője alapból ki van kapcsolva.
- **N > 0 hónap**: a random húzás N hónapig nem húzza újra a kérdést, a
  kvízösszerakó figyelmeztet, a „Csak még nem játszott” szűrő alapból be van
  kapcsolva. Kézzel ilyenkor is hozzáadható.

## Este másolása

Kvízesték › kijelölt este › „Este másolása új estére”: új, váró állapotú est
jön létre `„<cím> (másolat)”` néven, ugyanazokkal a körökkel, kérdésekkel,
sorrenddel, „állás a kérdés után” beállításokkal, vizuális köntössel és
csapatkód-beállítással. Nem másolódik: helyszín, időpont, nyilvánosság,
létszámkorlát, leírás, csapatok, jelentkezések. A másolás után az Esemény
oldal nyílik meg, ahol ezeket meg lehet adni (`duplicateGame()`,
`src/lib/server/games.ts`).
