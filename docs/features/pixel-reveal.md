# Pixeles képfelfedés

## Cél

Képfelismerős kérdésekhez: a kérdés képe erősen pixelesen jelenik meg, és a
visszaszámlálás alatt fokozatosan élesedik. Aki már a homályos képnél
felismeri, korábban válaszol, és a meglévő időalapú pontcsökkenés
(`points_decay`, `docs/features/scoring.md`) miatt több pontot kap — ehhez
nem kellett új pontozási logika.

## Döntés: kapcsoló, nem külön kérdéstípus

A pixelezés a kép **megjelenítését** szabályozza, nem a válaszadás módját.
Kapcsolóként bármely kérdéstípussal kombinálható (4 opciós „Mi ez?”,
csúszkás „Melyik évben készült?”, sorrend), míg egy önálló típus csak egy
válaszformával működne, és új ágat igényelne a pontozásban, a válasz-
táblákban, az admin űrlapon és mindhárom élő felületen. A döntés előtt egy
interaktív demó készült a kinézetről és az élesedés ütemezéséről.

## Adatmodell és protokoll

- `questions.image_pixelate boolean not null default false`
  (`supabase/migrations/20260925150000_question_image_pixelate.sql`). Kép
  nélkül a szerver mindig `false`-ként menti (`parseQuestionForm`).
- `question_show` payload: `image_pixelate?: boolean`
  (`docs/architecture/REALTIME_PROTOCOL.md`).
- `current_question_state()` is visszaadja, így egy újracsatlakozó csapat
  vagy TV ugyanúgy pixelesen látja a képet.

## Megjelenítés — `src/lib/components/PixelatedImage.svelte`

- Vászonra (canvas) rajzolt kép: kicsinyítve egy kis vászonra, majd
  simítás nélkül (`imageSmoothingEnabled = false`) felnagyítva.
- Felbontás: a visszaszámlálás elején 12 „kocka” széles, és exponenciálisan
  (a szemnek egyenletes ütemben) élesedik a teljes felbontásig:
  `oszlopok = 12 · (szélesség / 12)^haladás`.
- A haladást a kalibrált szerveridőhöz (`serverNow()`,
  `src/lib/realtime/server-clock.ts`) és a `timer_start` időbélyegéhez
  méri, így a TV és minden telefon ugyanabban a pillanatban ugyanazt látja.
- A timer indulása előtt a legpixelesebb állapot látszik; lezáráskor
  (lejárt idő, „Zárás most”, automatikus lezárás) azonnal az eredeti kép.
- Felületek: `/play` és `/tv` (a TV nagyobb, `--pixel-max-height: 28rem`).
  A host a saját kis előnézetében az eredeti képet látja, alatta egy
  megjegyzéssel, hogy a csapatok pixelesen látják.

## Admin

A kérdés-űrlapon a „Pixeles felfedés” jelölőnégyzet csak akkor jelenik meg,
ha a kérdéshez kép van feltöltve.

## Ismert korlát

A kép eredeti (éles) URL-je benne van a `question_show` payload-ban, tehát
egy ügyes játékos a böngésző fejlesztői eszközeivel megnyithatná. Baráti
kvíznél ez elfogadható; ha nem, a szervernek előre elkészített pixeles
változatokat kellene tárolnia és időzítve kiküldenie.
