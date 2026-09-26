# Kvízösszerakó (`/admin/games/[id]`)

Állapot: **kész** (2026-09-26). A korábbi, űrlapmezős kör-szerkesztő helyére
Kahoot-ihletésű, de saját, képernyőkből álló felület került. A jóváhagyott
terv (9 képernyő) a „Kvízösszerakó – koncepció” artifactban van.

## Felépítés

- **Menetrend (bal):** körök és kérdéskártyák (szám, szöveg, típus, idő;
  `!` hiba, `•` mentés folyamatban, `●` állás a kérdés után), „Kör vége ·
  Top 3” kártya, kör átnevezése (kattintás a névre), törlése, új kör.
- **Vászon (közép):** a kérdés úgy, ahogy a kivetítőn látszik: szöveg, kép
  (behúzás / tallózás / Ctrl+V, pixeles felfedés jelzése), és a válaszok
  **mind az 5 meglévő típusra**:
  - Egy helyes: 4 kártyaszínes lap (♠ ♥ ♦ ♣), egy helyes.
  - Több helyes: 6–8 lap (az 5–8. világosabb árnyalat + szám: ♠5 … ♣8),
    több helyes; lapokhoz kép.
  - Igaz / hamis: két nagy lap, a helyes kiválasztása.
  - Csúszka: min / max / lépés / helyes érték / tűrés, sávos előnézettel.
  - Sorrend: a helyes sorrend felülről lefelé (húzás, ↑↓ gombok, Alt+↑↓,
    Enter az utolsón új elem).
- **Beállítások (jobb):** típus (T), válaszidő (10/20/30/45/60/90 + **egyéni
  mező**, 5–600 mp), **olvasási idő** (Alap / Egyéni), pont, Normál/Dupla,
  gyorsasági pontcsökkenés, „Állás a kérdés után (kivetítő)”, pixeles
  felfedés, téma, Duplikálás, Eltávolítás a körből.
- **Áttekintés (O):** körönként egy sáv, húzással / Alt+nyilakkal
  átrendezhető (körök között is), becsült játékidő, „Random töltés minden
  körbe”, és az **indulás előtti ellenőrzés**: hiba (hiányos kérdés) esetén
  az „Élő lebonyolítás” nem enged tovább; figyelmeztetés: már elhangzott
  kérdés, ugyanaz a helyes lap egymás után, üres kör. F8 a következőre ugrik.
- **Kérdésbank-fiók (B):** a szerkesztő fölött nyílik (nem navigál el):
  keresés, téma/típus szűrő, „Csak még nem játszott” (más, már elindított
  estén szerepelt-e), „Van kép”, többes kijelölés, hozzáadás az aktuális
  kérdés után; random húzás a témából (a pihentetési idő szerint).
- **Előnézet (P):** kivetítő-nézet, a helyes válasz jelölése nélkül.

A kérdésbank új/szerkesztő oldala (`/admin/questions/new`, `/[id]`) ugyanazt
a vásznat és beállításpanelt használja (`QuestionEditor`), hagyományos
Mentés gombbal.

## Mentés

- A kliens a szerkesztés igazság-forrása: a kérdések piszkozatként élnek
  (`src/lib/builder/model.ts`), és **automatikusan mentődnek** (700 ms
  után), amint érvényesek. Az érvényességet a szerverrel **közös**
  `parseQuestionForm` / `validateQuestionForm` dönti el
  (`src/lib/questions/form.ts`), így a kliens és a szerver sosem tér el.
- Új kérdés (N) csak akkor kerül a kérdésbankba, amikor teljes; addig a
  vászon felett látszik, mi hiányzik. Elhagyáskor figyelmeztet, ha van
  hiányos piszkozat.
- Műveletek: `POST /admin/games/[id]/builder` (JSON: `save`, `setRound`,
  `setStandings`, `duplicate`, `addFromBank`, `draw`, `drawAll`, `addRound`,
  `renameRound`, `deleteRound`). Minden a kezelő saját kliensén fut (RLS +
  security-definer RPC-k szerepkör-ellenőrzése).
- A kör sorrendje egy lépésben: `admin_set_round_questions(round_id, ids[])`
  — átrendezés, eltávolítás, beszúrás adott helyre és a visszavonás is ezt
  használja; a meglévő sorok `show_standings` értéke megmarad.
- **Visszavonás (Ctrl+Z / Ctrl+Y):** a szerkezeti műveletekre (áthelyezés,
  eltávolítás, hozzáadás, duplikálás, random húzás). A szövegmezőkben a
  böngésző saját visszavonása él. Kör törlése nem vonható vissza
  (megerősítést kér).
- A kérdés a bankban él, tehát a szerkesztése minden estét érint, ahol
  szerepel (ez a korábbi viselkedés is volt).

## Billentyűzet

Az egybetűs parancsok csak szövegmezőn kívül élnek; szövegmezőből Esc visz
vissza a menetrendbe. Teljes lista: `?` (ShortcutHelp).

| Csoport     | Billentyűk                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Navigálás   | ↑/↓ (J/K) kérdések, Ctrl+↑/↓ körök, Home/End, O áttekintés                                                     |
| Szerkesztés | Enter kérdésszöveg, Tab mezők, 1–8 helyes válasz, Alt+1–8 lap szövege, T típus, Alt+↑/↓ áthelyezés, Ctrl+V kép |
| Létrehozás  | N új kérdés, Shift+N új kör, B kérdésbank (benne R random), Ctrl+D duplikálás, Del eltávolítás a körből        |
| Egyéb       | P előnézet, Ctrl+Z/Y, Ctrl+S mentés most, F8 következő hiba, ? súgó, Esc                                       |

## Ellenőrzés

Mock adatos böngészős harness-szel (Playwright): automatikus mentés,
új kérdés mentése a kör megfelelő helyére, áthelyezés, eltávolítás +
visszavonás, bank-fiók billentyűzettel, áttekintés, súgó, előnézet, mobil
(390 px, vízszintes görgetés nélkül). DB-oldal: `admin_set_round_questions`,
`admin_duplicate_question` élőben, rollback-kal lezárt tranzakcióban.
