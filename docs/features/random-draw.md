# Random húzás + cooldown

## Cél

Egy kvízeste körének összeállításakor az admin egy témát választ, és a
rendszer a témához tartozó kérdésbankból automatikusan válogat be `N`
kérdést a kör `round_questions` listájába — úgy, hogy egy kérdés ne
ismétlődjön túl gyakran különböző esteken.

## Cooldown

Az `app_settings` tábla `question_reuse_cooldown_months` kulcsa (alapból 6
hónap, csak `super_admin` módosíthatja) mondja meg, hány hónapig maradjon ki
egy kérdés a húzásból, miután utoljára szerepelt egy körben.

Egy kérdés akkor húzható be, ha:

- `last_used_at is null` (sosem játszották), VAGY
- `last_used_at < now() - cooldown hónap`

A `last_used_at`-et a `trg_update_question_last_used` trigger frissíti
automatikusan minden `round_questions` beszúráskor — az admin felületnek
nem kell manuálisan karbantartania.

## `draw_random_questions_for_round(p_theme_id, p_round_id, p_count)`

Postgres függvény (`security definer`, csak `authenticated`-nek grantelve,
belül `current_user_role_id() in (1,2)`-re ellenőrizve), ami:

1. Kiolvassa a cooldown hónapszámot az `app_settings`-ből.
2. A megadott témájú kérdések közül kiválasztja azokat, amik cooldown-on
   kívül esnek, ÉS még nincsenek benne a célkör `round_questions`
   listájában (ismételt húzásnál nem próbál duplikátumot beszúrni — ez a
   `docs/architecture/DATA_MODEL.md` 2. szakaszának mintapéldájához képesti
   kiegészítés, mert anélkül egy második húzás ütközne a
   `round_questions` elsődleges kulcsával).
3. `order by random() limit p_count` — véletlenszerű válogatás.
4. Beszúrja a kiválasztott kérdéseket a `round_questions`-be, a kör
   meglévő `order_index`-e után folytatva a sorszámozást.
5. Visszaadja a beszúrt `questions` sorokat.

Az admin felület (`/admin/games/[id]`) körönként hívja ezt egy téma- és
darabszám-választóval; a visszatérő kérdések azonnal megjelennek a kör
listájában, eltávolítás gombbal.

## Admin felület

- `/admin/themes` — témák CRUD.
- `/admin/questions` — kérdésbank lista (téma szerint szűrhető),
  típusonkénti dinamikus űrlap (`src/lib/components/QuestionForm.svelte`)
  az öt kérdéstípushoz (single_choice, multi_choice, true_false, slider,
  ordering).
- `/admin/games` — "kvízesték" (a `games` tábla draft sorai) listája és
  létrehozása; `/admin/games/[id]` a körök (`rounds`) kezelése és a
  Random húzás.

A `games`/`rounds` tábla ezen a ponton még csak az estekonstrukciót
szolgálja — a valós PIN/QR-alapú lebonyolítás (csapatok csatlakozása,
lobby) Fázis 3-ban épül rá.
