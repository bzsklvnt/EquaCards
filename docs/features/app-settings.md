# Globális beállítások (`/admin/settings`)

## Cél

A review #2 admin-hézaga: az `app_settings` tábla (`docs/architecture/DATA_MODEL.md` 2. szakasz) eddig csak SQL-lel volt szerkeszthető
(`update app_settings set value = ... where key = '...'`). Ez a dokumentum
a `/admin/settings` generikus kulcs-érték szerkesztőt írja le.

## Hozzáférés

Csak `role_id = 1` (super_admin) — route-szintű guard
(`src/routes/admin/settings/+page.server.ts`), ugyanaz a minta, mint a
`/admin/users`-nél (Fázis B). Az `app_settings_write_super_admin` RLS
policy (Fázis 2 óta létezik) már pontosan ezt a szűkítést kényszeríti ki
DB-szinten is — **nem kellett új RLS-t írni**.

## Generikus, nem hardcode-olt kulcs-lista

A `load()` egyszerűen `select key, value, updated_at from app_settings
order by key` — bármi, ami a táblában van, megjelenik a listában, kód-
módosítás nélkül. Egy jövőbeli `insert into app_settings (key, value)
values ('uj_beallitas', ...)` (akár SQL-lel, akár egy jövőbeli admin
"+ Új beállítás" funkcióval) automatikusan felbukkan itt.

**Érték-típus felismerés** (`typeof setting.value` a betöltött jsonb
alapján) dönti el, milyen input-widget jelenjen meg:

| JS típus                   | Widget                            |
| -------------------------- | --------------------------------- |
| `number`                   | `Input type="number"`             |
| `boolean`                  | `Checkbox`                        |
| `string`                   | `Input type="text"`               |
| objektum/tömb (minden más) | `Textarea monospace` (nyers JSON) |

A form egy rejtett `value_type` mezőt is küld, hogy a szerver-oldali
action tudja, vissza milyen JS típusra kell parse-olnia a beküldött
string-et (`Number()`, `=== 'true'`, `JSON.parse()`, vagy nyers string) —
ez akadályozza meg, hogy pl. a cooldown hónapszám string-ként íródjon
vissza a jsonb-be szám helyett.

## Barátságos címkék (prezentációs réteg, nem a lista forrása)

A kulcs-lista maga sosem hardcode-olt (lásd fent), de egy kis
`SETTING_META` lookup (`src/routes/admin/settings/+page.svelte`) ismert
kulcsokhoz barátságosabb címkét/mértékegységet/leírást ad — jelenleg csak
`question_reuse_cooldown_months` kap "Kérdés-újrafelhasználási türelmi
idő" címkét és "hónap" mértékegységet. Egy ismeretlen (a lookup-ban nem
szereplő) kulcs ettől függetlenül helyesen megjelenik, csak a nyers
kulcsnevét mutatja címke helyett — a lookup bővítése tisztán UX-finomítás,
nem funkcionális követelmény egy új beállítás megjelenéséhez.

## Jelenlegi kulcsok

| Kulcs                            | Típus  | Jelentés                                                                                                                |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `question_reuse_cooldown_months` | number | Ennyi hónapig nem húzható újra ugyanaz a kérdés a `draw_random_questions_for_round` RPC-nél (DATA_MODEL.md 2. szakasz). |

## Visszajelzés

Ugyanaz a `svelte-sonner` toast minta, mint a `/admin/users`-nél (Fázis
B) — a `Toaster` már globálisan fel van szerelve az `/admin` layout-ban,
nem kellett újra bekötni.

## Globális alapértelmezett design téma (Fázis P5)

Az oldal tetején egy külön szekció (nem `app_settings` sor — a
`design_themes.is_default` mező, `docs/architecture/DATA_MODEL.md` 8.
szakasz) egy legördülőt ad a felvitt design témákkal. Ez **nem új
funkcionalitás** — az `is_default` eddig is állítható volt egy adott téma
teljes szerkesztő oldalán (`/admin/design-themes/[id]`, checkbox) —, csak
egy gyorsabb, dedikált útvonal ugyanahhoz a mezőhöz, hogy egy super_admin
ne kelljen a teljes szerkesztő formot megnyitnia csak ehhez. A `?/set_default_theme`
action egyetlen `update design_themes set is_default = true where
id = ...`-t futtat; az `enforce_single_default_design_theme()` trigger
(Fázis 6) automatikusan leveszi az `is_default`-ot a korábbi
alapértelmezettről — nincs itt sem külön "előbb kapcsold ki a régit"
logika.

A választás **azonnal, oldal-újratöltés nélkül** alkalmazódik minden
nyitott felületen (admin/riportok, és minden olyan kvízeste, aminek nincs
saját `design_theme_id`-ja) — lásd
`docs/architecture/DESIGN_SYSTEM.md` "Reaktív design téma alkalmazás
(Fázis P5)" szakasz.
