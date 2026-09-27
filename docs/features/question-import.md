# Kérdésbank-import CSV-ből

Állapot: **kész** (2026-09-27). Kérdésbank › „Importálás CSV-ből” (vagy
Ctrl+K › „Kérdések importálása CSV-ből”), útvonal: `/admin/questions/import`.

## Folyamat

1. **Fájl** — letölthető minta (`kerdesbank-minta.csv`, pontosvesszős,
   UTF-8 BOM-mal, hogy az Excel jól nyissa). Pontosvesszős, vesszős és
   tabulátoros fájl is jó; a nem UTF-8 fájlt (az Excel magyar beállítással
   Windows-1250-ben ment) a böngésző annak olvassa. Max. 5 MB, 2000 sor.
2. **Előnézet** — soronként: téma, típus, kérdés és állapot (hiba szövege,
   duplikátum vagy „Rendben”). Összesítő: hibátlan / hibás / duplikátum.
   - **Témák:** a meglévővel (kis- és nagybetűtől függetlenül) egyező téma oda
     kerül; az ismeretlent alapból létrehozza, de átirányítható meglévő témára
     vagy „téma nélkül”-re. A téma nélküli sorok is hozzárendelhetők egy témához.
   - **Duplikátum:** azonos kérdésszöveg (kis- és nagybetű, szóközök nélkül
     összevetve) ugyanabban a cél-témában — a bankban vagy a fájlban korábban.
     Alapból kimarad („Duplikátumok kihagyása”).
3. **Importálás** — előbb a hiányzó témák jönnek létre, majd a kérdések
   40-es kötegekben, haladásjelzővel. A hibás sorok kimaradnak; a mentéskor
   hibázó sorok listája a végén látszik.

## Oszlopok

A fejléc kis- és nagybetűtől, ékezettől függetlenül ismert fel
(`src/lib/questions/csv.ts`):

| Oszlop                 | Tartalom                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| téma                   | a téma neve                                                                               |
| típus                  | egy helyes · több helyes · igaz/hamis · csúszka · sorrend (üresen a kitöltésből derül ki) |
| kérdés                 | kötelező                                                                                  |
| A–H                    | válaszok (egy helyes: 4, több helyes: 6–8); sorrendnél az elemek a helyes sorrendben      |
| helyes                 | betű(k): `A` / `A,C`; igaz/hamis: `igaz` / `hamis`; csúszka: a helyes szám                |
| min, max, lépés, tűrés | csak csúszkához                                                                           |
| idő, pont, kép         | nem kötelező: válaszidő (alap: Beállítások › Játék), pont (1000), kép `https://` címe     |

## Ellenőrzés és mentés

- A kliens minden sort ugyanazzal a szabálykészlettel ellenőriz, mint a kézi
  mentés (`draftError()` → `parseQuestionForm` / `validateQuestionForm`).
- A szerver (`/admin/questions/import`, `POST`, csak 1–2. szerepkör) minden
  kérdést újra ellenőriz és a `saveDraft()` → `admin_save_question()` úton
  ment; az import mindig új kérdést hoz létre (a küldött azonosítót
  figyelmen kívül hagyja). Egy kérésben legfeljebb 50 kérdés.
- Magyarázó dia (Info) és videó CSV-ből nem importálható — ezeket a
  kvízösszerakóban érdemes összeállítani.
