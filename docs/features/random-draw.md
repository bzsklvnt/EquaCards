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

A függvény maga változatlan, csak a UI-triggerelés változott (Fázis O6,
lásd lent) — körönkéntiből egy este-szintű, összesített gombra.

## UI munkafolyamat (Fázis O6 — este-szintű téma-választó)

Élő tesztelés jelezte, hogy a korábbi, körönkénti "válassz témát ÉS
darabszámot, majd nyomd meg a Random húzást" munkafolyamat lassú volt
egy több körös este összeállításánál (minden kör ugyanabból a témából
húz jellemzően). Az `/admin/games/[id]` mostantól:

1. **Egyetlen, este-szintű téma-választó** az oldal tetején (nem
   körönként) — `?/drawAll` action `theme_id` mezője.
2. **Minden kör megtartja a saját "Darabszám" mezőjét** (kliens-oldali
   `roundCounts` state, körönként, nem küldődik önállóan formán
   keresztül — a "Kérdések betöltése minden körbe" gomb formájába egy
   rejtett `rounds_json` mezőben (`[{round_id, title, count}, ...]`)
   szerializálódik beküldéskor, mert a Darabszám mezők a DOM-ban NEM a
   `<form>` leszármazottai — a kör-kártyák és a fejlécben lévő form
   vizuálisan/logikailag szét vannak választva).
3. **Egyetlen "Kérdések betöltése minden körbe" gomb** — a `?/drawAll`
   action egy hívásban végigmegy a `rounds_json`-ból kapott összes
   körön, mindegyikre külön meghívja a fenti
   `draw_random_questions_for_round`-ot a globális témával és a kör
   saját darabszámával. Ha egy adott körhöz nincs elérhető kérdés
   (cooldown/kimerült pool), a hibaüzenet megnevezi, melyik kör("ök")
   érintett(ek), nem csak egy generikus hibát ad.
4. A körönkénti, egyedi témájú húzás lehetősége ezzel **megszűnt** — ha
   egy este különböző témájú köröket igényelne, az admin egymás után,
   más-más témával is futtathatja a "betöltés minden körbe" gombot.
   **Fontos:** egy már megtöltött körre újra futtatva a gombot a
   `draw_random_questions_for_round` NEM cseréli/tölti fel a meglévő
   `count`-ra, hanem **további** `count` darab, még be nem szúrt
   kérdést ad hozzá a meglévők mellé (a 2. pont "ismétlődő húzásnál nem
   duplikál" logikája csak az egyedi kérdés-ismétlődést zárja ki, nem a
   végösszeget korlátozza) — ha egy adott kör véglegesen csak a
   megadott darabszámot tartalmazza, azt az admin a felesleges
   kérdések "Eltávolítás" gombjával tudja kézzel véglegesíteni.

## Kézi összeállítás a random húzás mellett (élő teszt utáni kör)

Az `/admin/games/[id]` körkártyáin a random húzás mellett három új út van:

1. **"+ Kérdés a kérdésbankból"** — körönként lenyíló választó
   (egyszerre egy kör választója lehet nyitva): téma-szűrő (alapból az
   este globális témája, "összes téma" is választható) + szabadszöveges
   keresés, a körben már szereplő kérdések kiszűrve, jelölőnégyzetes
   többes kijelöléssel. `?/addQuestions` action → a közös
   `appendQuestionsToRound()` (`src/lib/server/questions.ts`) a kör
   VÉGÉRE fűzi őket (`order_index` = eddigi max + 1…), a már szereplőket
   kihagyja.
2. **"+ Új kérdés ehhez a körhöz"** — a kör szerkesztőjén belül, felugró
   ablakban (natív `<dialog>`) nyílik meg a kérdés-űrlap, a téma az este
   globális témájával előre kiválasztva. Mentéskor (`?/createQuestion`, a
   közös `createQuestionFromForm()` + `appendQuestionsToRound()`) a kérdés
   a kérdésbankba kerül ÉS azonnal a kör végére; az ablak bezárul, a kör
   listája frissül, az oldal nem töltődik újra és nem navigál el. (Élő
   tesztből: korábban a `/admin/questions/new` oldalra vitt, ami a
   kérdésbankban való elvesztés érzését keltette.) Ha a körhöz fűzés nem
   sikerül, a hibaüzenet jelzi, hogy a kérdés a bankban már elmentődött. A
   `/admin/questions/new?round_id=…` útvonal továbbra is működik.
3. **"Összes kérdés törlése"** — `?/clearRound`, a kör összes
   `round_questions` sorát törli (a kérdések a bankban maradnak). Csak
   akkor jelenik meg, ha a körben van kérdés. Szándékosan nincs megerősítő
   dialógus (Fázis Q4 döntés), a kör egy húzással/válogatással újratölthető.

A random húzás gombja "Random kérdések betöltése minden körbe" feliratot
kapott, hogy egyértelmű legyen a különbség a kézi válogatástól. A húzás
maga szándékosan továbbra is SOROS körönként (nem párhuzamos): a cooldown
a `last_used_at`-re támaszkodik, amit a `round_questions` insert-trigger
frissít — párhuzamos hívásnál két kör ugyanazt a kérdést kaphatná.

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
