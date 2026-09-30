# AI-segéd a kvízösszerakóban

Két funkció, mindkettő csak gombnyomásra fut (nincs automatikus AI-hívás):
**AI kérdésjavaslat** és **Ellenőrzés AI-val**. Mellettük AI nélküli,
szabályalapú ellenőrzés is fut, folyamatosan.

## Beállítás

- `ANTHROPIC_API_KEY` környezeti változó (Vercel › Settings › Environment
  Variables). Csak a szerveren él, a böngészőbe soha nem kerül. Ha hiányzik,
  a gombok inaktívak, és a felirat megmondja, mi hiányzik.
- `ANTHROPIC_MODEL` (nem kötelező): a használt Claude-modell azonosítója.
  Ha üres, a szerver a Models API listájából a legújabb Opus modellt
  választja (ha nincs, a legújabbat), így új modellnél nem kell kódot
  módosítani.
- Hívás: `src/lib/server/ai.ts` (Messages API, `fetch`). A válasz
  szerkezetét egy kötelezően hívott tool sémája rögzíti, így mindig
  érvényes JSON jön vissza.
- Végpont: `POST /admin/games/[id]/ai` (`op: suggest | review`), csak
  admin/szerkesztő (role 1–2). Vercelen 120 mp futásidő.

## AI kérdésjavaslat

- A kvízösszerakó menetrend-oszlopában: „✦ AI javaslat” gomb, ami egy
  jobb oldali fiókot nyit (`src/lib/builder/AiSuggestDialog.svelte`).
- **Kontextus: csak az aktuális kvízeste.** A szerver az adatbázisból tölti
  be az este köreit és kérdéseit (válaszokkal együtt), a kérdésbank többi
  része nem kerül az AI elé.
- Beállítások: célkör („Hová kerül?”), darab (3/5/8/10), típus (vegyes /
  egy helyes / több helyes / igaz-hamis / csúszka), nehézség, szabad
  szöveges kérés.
- A javaslatok előnézetként jönnek: kérdés, lehetőségek, a helyes jelölve,
  egy mondat indoklás. Jelölőnégyzettel választhatók, ✕-szel elvethetők.
  Semmi nem kerül a körbe elfogadás nélkül.
- Elfogadáskor a kérdések új piszkozatként a kör végére kerülnek, és
  egymás után mentődnek, így a kör sorrendje nem ütközik. Mentés után a
  kérdésbankban is megvannak. A téma a kör leggyakoribb témája, az idő és a
  pontozás a kör első kérdéséé. Visszavonható (Ctrl+Z).
- Szűrés: a szerkezetileg hibás javaslat (pl. két helyes egy helyesnél, a
  tartományon kívüli csúszka-érték) és az estén már szereplő kérdéssel
  azonos szövegű javaslat kimarad (`suggestionUsable`, `promptKey`).

## Kérdés-ellenőrzés

### Szabályalapú (AI nélkül, mindig fut)

A `src/lib/builder/issues.ts` `draftWarnings()` és `computeIssues()` függvénye
figyelmeztet, de nem tiltja az indulást:

- a kérdés 160 karakter felett (csak ha a telefonon is látszik a szöveg);
- egy válasz 45 karakter felett;
- azonos válaszlehetőségek (kis- és nagybetűtől, szóköztől függetlenül);
- a körben (legalább 4 kérdésnél) minden helyes válasz ugyanazon a lapon.

Ezek az Áttekintés ellenőrzőlistájában és a szerkesztőben a kérdés fölött
is látszanak.

### Ellenőrzés AI-val (gombnyomásra)

- **Egy kérdés:** a szerkesztőben a kérdés fejlécében „✦ Ellenőrzés AI-val”.
- **Egész este:** az Áttekintés ellenőrzőlistája alatt. A körök
  párhuzamosan mennek, körönként egy hívással (legfeljebb 40 kérdés).
- Az AI ezt nézi: helyes-e a megjelölt válasz, van-e másik jó válasz,
  egyértelmű-e a kérdés, van-e elírás, és nem túl hosszú-e telefonra.
- Az észrevételek „✦ AI:” jellel az ellenőrzőlistába kerülnek
  (figyelmeztetésként, nem tiltják az indulást). A szerkesztőben a
  kérdés fölött látszanak: „Átvétel” (egy kattintással alkalmazza a javasolt
  javítást: kérdésszöveg, válaszszövegek, helyes válasz, csúszka-érték) vagy
  „Elvetés”.
- Automatikusan semmi nem íródik át. A javítás csak akkor alkalmazható, ha
  illik a kérdésre (`applyFix`: azonos számú válasz, érvényes index).
- Az észrevétel a vizsgált változathoz tartozik: ha a kérdést közben
  szerkesztik, az elavult észrevétel eltűnik (aláírás-összevetés).

## Tesztek

`src/lib/__tests__/ai-checks.test.ts`: szabályalapú figyelmeztetések,
javaslat-érvényesség és piszkozattá alakítás, duplikátumszűrés, javítás
átvétele.
