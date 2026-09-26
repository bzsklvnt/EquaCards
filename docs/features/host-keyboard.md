# Élő lebonyolítás billentyűzettel (`/host/[game_id]`)

Állapot: **kész** (2026-09-26).

## Lépések

Kérdésenként egy lépéssáv mutatja, hol tart a host: **Olvasás → Válaszidő
→ Felfedés → Állás a körben → Következő**. A kiemelt gomb mindig a
következő lépés, és a **Space** (vagy Enter, ha nem egy gombon áll a fókusz)
mindig azt nyomja meg:

| Állapot          | Kiemelt lépés (Space)                                      |
| ---------------- | ---------------------------------------------------------- |
| kérdések között  | Következő kérdés                                           |
| olvasási idő     | Olvasás átugrása                                           |
| válaszidő        | Válaszok lezárása most (lejártakor magától zár és feltár)  |
| lezárva          | Megoldás feltárása                                         |
| felfedés után    | Állás a körben / Következő kérdés (kérdésenként beállítva) |
| állás után       | Következő kérdés                                           |
| kör vége (Top 3) | Következő kör                                              |

Egyéb billentyűk: **S** a felfedés utáni másodlagos lépés (állás kihagyása),
**L** azonnali lezárás, **M** kivetítő hang ki/be, **C** csapatkódok (késve
érkezőknek), **?** súgó, **Esc** bezárás.

## Biztonság

- Dupla lenyomás ellen: futó lépés alatt és 0,8 mp-en belül a második
  lenyomás nem léptet.
- A **játék lezárásának nincs gyorsbillentyűje** — csak gombbal.
- Szövegmezőben és nyitott ablakban a billentyűk nem élnek.

## Hang

A host néma; hang csak a kivetítőn szól (`docs/features/tv-mode.md`). A
host oldalsávján a „Hang: csak a kivetítőn” gomb (M) távolról némít.

## Csapatok köri állása

A host minden felfedés után elküldi a kör állását (`round_standings_update`),
a csapatok telefonja ebből mutatja a saját helyüket és a szomszédaikat
(`src/lib/components/RoundStanding.svelte`) — akkor is, ha a kivetítős
állás kimarad.
