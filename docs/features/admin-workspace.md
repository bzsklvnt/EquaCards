# Kezelőfelület: munkaterület-elrendezés

A kvízösszerakó (`docs/features/quiz-builder.md`) háromoszlopos, billentyűzettel
vezérelhető elrendezése az egész kezelőfelületen (`/admin/**`, `/reports`).
Minden oldal ugyanúgy épül fel: **bal oldalt lista, középen a kiválasztott elem,
jobb oldalt műveletek és beállítások**, alul billentyű-sáv. Külön
„szerkesztő oldal” nincs: az elemet a helyén, automatikus mentéssel szerkeszted.

## Héj (`src/lib/components/DashboardShell.svelte`)

- **Felső menüsor** (a korábbi oldalsáv helyett): márka, szerepkör szerinti
  menü (a rendszergazda-pontok elválasztó után), „Keresés, parancs…” gomb,
  Bemutató gomb, `?` súgó, felhasználói menü (kijelentkezés). 980px alatt
  „Menü ▾” lenyíló, 520px alatt a billentyű-jelzések és a `?` rejtve (telefonon
  nincs billentyűzet), a Bemutató gomb csak ▶.
- **Munkaterület-mód**: a kvízösszerakó és a kvízeste Esemény/Eredmények nézete
  (`workspace: true` a szerver loadban) saját fejlécet kap (`GameHeader`), a
  felső menüsor ilyenkor rejtve (`--topbar-h: 0`).
- **Ctrl K — parancspaletta** (`src/lib/components/admin/CommandPalette.svelte`):
  oldalak, gyors műveletek (új kvízeste / kérdés / helyszín, játék-
  beállítások), és 2 karaktertől a `/admin/search` végpont találatai
  (kvízesték, kérdések, helyszínek, témák — `ilike`, csak 1–2. szerepkör).
  Enter megnyit, kvízestén Shift+Enter az Esemény oldalt nyitja.
- **G + betű — ugrás**: V Vezérlőpult, E Kvízesték, K Kérdésbank, T Témák,
  H Helyszínek, D Vizuális témák, R Riportok, F Felhasználók, B Beállítások
  (csak a szerepkör által látható oldalak).
- **`?` súgó**: a globális parancsok mellett az aktuális oldal saját csoportjai
  (`registerPageShortcuts()`, `src/lib/admin/keys.svelte.ts`).

Az egybetűs parancsok soha nem sülnek el szövegmezőben vagy nyitott
párbeszédablakban (`plainKey()` / `isTypingTarget()`).

## Építőelemek

| Elem                                   | Szerep                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `components/admin/Workspace.svelte`    | Háromoszlopos rács (`rail` · `main` · `side` snippetek) + billentyű-sáv. `fill`: a héj alatti teljes magasság. 720px alatt egy oszlop. |
| `components/admin/RailList.svelte`     | Csoportosított, szűrhető lista. ↑/↓ vagy J/K lépked, `/` a szűrőbe ugrik, Enter megnyit (`onopen`).                                    |
| `components/admin/GameHeader.svelte`   | Kvízeste fejléc: Szerkesztő · Áttekintés · Esemény · Eredmények fülek + „Élő lebonyolítás”.                                            |
| `components/admin/SettingField.svelte` | Egy beállítás saját űrlappal, gyors választókkal és automatikus mentéssel.                                                             |
| `components/admin/workspace.css`       | Közös `ws-*` osztályok (kártya, csempe, gomb, mező, chip, táblázat) — a héj importálja globálisan.                                     |
| `admin/selection.svelte.ts`            | `createSelection('id', fallback)`: a kiválasztott elem a `?id=` paraméterben él (`replaceState`), így a link megosztható.              |
| `admin/autosave.svelte.ts`             | `createAutosave({ snapshot, submit })`: a mezők változása után ~700 ms-mal `requestSubmit()`; állapot: mentés… / mentve / hiba.        |

**Automatikus mentés elemváltáskor:** az oldal a kiválasztás átállítása
**előtt** hívja az `autosave.flush()`-t (még a régi űrlappal megy el a
mentés), majd az új elem mezőinek betöltése után `reset()`-et — így a
függőben lévő módosítás soha nem íródik rá a következő elemre.

## Oldalak

| Oldal                         | Lista                                    | Közép                                                        | Jobb oldal                                                                                  |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Vezérlőpult `/admin`          | közelgő esték                            | köszöntés, csempék, élő este sáv, kijelölt este              | gyors műveletek                                                                             |
| Kvízesték `/admin/games`      | Élő · Közelgő · Lezárt · Próbaesték      | csempék, menetrend (körönkénti kérdésszám), teendők az estig | Enter összerakó, E esemény, R eredmények, L élő, V kivetítő; N új (`?new=1`)                |
| Esemény `…/[id]/event`        | jelentkezések (Bekerült · Várólista · …) | csapatkód, kapcsolat, beengedés (P) / lemondás (Del)         | esemény-beállítások automatikus mentéssel, megjelenés; W helyszíni csapat, CSV export       |
| Eredmények `…/[id]/results`   | kérdések körönként                       | a kérdés válaszai csapatonként                               | kör- és esti összesítés                                                                     |
| Kérdésbank `/admin/questions` | szűrhető kérdéslista                     | a kvízösszerakó vászna (`QuestionCanvas`)                    | beállítások, használat (mely estéken), „Hozzáadás körhöz”; N új, Ctrl D másolat, Del törlés |
| Témák `/admin/themes`         | témák                                    | átnevezés, a téma kérdései                                   | statisztika, törlés                                                                         |
| Helyszínek `/admin/venues`    | helyszínek                               | adatok automatikus mentéssel, nyilvános oldal előnézete      | a helyszín estéi, törlés                                                                    |
| Vizuális témák                | témák                                    | élő TV- és telefon-előnézet                                  | színek, haladó JSON, alapértelmezett                                                        |
| Felhasználók                  | szerepkör szerint                        | profil, jogosultság (azonnal ment)                           | szerepkörök létszáma                                                                        |
| Beállítások                   | kategóriák (Játék, Megjelenés, …)        | a kategória beállításai (`SettingField`)                     | élesítés állapota                                                                           |
| Riportok `/reports`           | lezárt esték (`ReportsRail`)             | grafikonok / dobogó                                          | —                                                                                           |

**Átirányítások** (régi linkek nem törnek el): `/admin/questions/new` →
`?new=1`, `/admin/questions/[id]` → `?id=`, `/admin/design-themes/new` és
`/[id]` → a lista megfelelő eleme.

**CSV export** (Esemény): a jelentkezések kliens oldalon, pontosvesszővel
tagolva, UTF-8 BOM-mal (Excel magyar beállítással is jól nyitja).

**Új kérdés alap válaszideje**: `app_settings.question_default_time_seconds`
(Beállítások › Játék, alap 30 mp) — a kérdésbank és a kvízösszerakó új
kérdésének előtöltése (`docs/features/app-settings.md`).
