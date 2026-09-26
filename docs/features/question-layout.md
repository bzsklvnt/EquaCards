# Kérdés-megjelenés, magyarázó dia és YouTube-videó

Három, kérdésenként beállítható kiegészítés a kvízösszerakóban (Beállítások
panel). A pontszámítás és a válaszadás szabályai nem változtak.

## Megjelenés (`questions.layout`)

A Megjelenés szakasz kérdésenként állítja, mi hol látszik a kivetítőn és a
telefonon. A `null` érték az alapértelmezett kinézet (Klasszikus, időzítő
nagyban a válaszok alatt, számláló fent, normál betű, 1 oszlopos lapok,
kérdésszöveg a telefonon is), ami megegyezik a funkció előtti kinézettel.

| Mező           | Értékek                                                      |
| -------------- | ------------------------------------------------------------ |
| `preset`       | `classic`, `image_left`, `image_right`, `image_bg`, `text`   |
|                | videós kérdésnél: `video_full`, `video_split`                |
|                | magyarázó diánál: `info_split`, `info_image`                 |
| `timer`        | `corner` (sarokban), `below` (kérdés alatt), `big` (nagyban) |
| `counter`      | `top`, `bottom`, `hidden` — kör neve és „3 / 8”              |
| `size`         | `normal`, `large`, `xl` — a kérdés szövegének mérete         |
| `phone_cols`   | `1` vagy `2` — válaszlapok oszlopai a telefonon              |
| `phone_prompt` | a kérdés szövege a telefonon is látszik-e                    |

- A közös logika: `src/lib/questions/layout.ts` (`normalizeLayout`,
  `effectivePreset`, `stagePreset`). Kép nélkül a képes elrendezések a „Csak
  szöveg” szerint jelennek meg.
- A kivetítőt és a kvízösszerakó előnézetét ugyanaz a komponens rajzolja:
  `src/lib/components/QuestionStage.svelte`.
- Új kérdés az előtte kijelölt kérdés megjelenését örökli.
- „Alkalmazás a kör összes kérdésére”: a kör többi kérdése átveszi a
  beállításokat. Az info diák és a videós kérdések megtartják a saját
  elrendezésüket, csak a közös mezők (időzítő, számláló, méret, telefon)
  kerülnek át.

## Kártyalapok

A válaszlapok (`ChoiceButton` `suit` módban) krémszínű kártyák, a sarokban
betű + kártyaszín (A♠ B♥ C♦ D♣, 5–8. lapnál E–H világosabb árnyalattal). A
válasz szövege mindig látszik a telefonon is, nem csak a szín. Két oszlopnál
a lap álló, az index a jobb alsó sarokban tükrözve megismétlődik. A
beküldött lap „BEKÜLDVE” pecsétet kap; olvasás vagy videó alatt a lapok
szaggatott szélűek, de olvashatók. A sorba rendezés lapjai helyezést,
szöveget és ▲▼ gombokat mutatnak.

## Magyarázó dia (`question_types.code = 'info'`)

- Cím (`prompt`), opcionális szöveg (`questions.info_text`, max. 2000
  karakter) és kép. Nincs válasz, időzítő és pont.
- Élőben a `host_next_question()` a dia esetén nem indít időzítőt (a
  `games.current_question_*` időmezők nullák, így a `submit_answer` eleve
  elutasít), és nincs `timer_start`. A host Szóközzel lép tovább (uiStep
  `info`, a kiemelt lépés „Tovább”).
- A telefon „Nézd a kivetítőt!” képernyőt mutat.
- A sorszámozásba nem számít bele (kivetítő, telefon, host, kvízösszerakó,
  eredmények), a random húzás nem választja, az eredmények oldalon nem
  jelenik meg.

## YouTube-videó (`questions.video_*`)

- `video_id` (11 karakteres azonosító), `video_start` és `video_end`
  (másodperc, a részlet legfeljebb 300 mp), `video_gate`.
- `video_gate = true` („A videó után”): a válaszidő a klip végén indul — az
  olvasási idő a klip hossza (`host_next_question()`). Addig a telefonon a
  lapok inaktívak, „Figyeld a kivetítőt” sávval és hátralévő idővel.
- `video_gate = false` („Videó közben”): a szokásos olvasási idő (alapból
  5 mp) után lehet válaszolni, a videó közben tovább megy.
- Csak a kivetítő játssza le, `youtube-nocookie.com` lejátszóval
  (`src/lib/components/YouTubePlayer.svelte`). Hang csak akkor szól, ha a
  kivetítőn engedélyezték a hangot, és a host nem némította (M). A telefon
  nem tölt be YouTube-tartalmat.
- Újratöltött kivetítő a kérdés indulásához képest folytatja a klipet. A host
  R-rel újrajátszathatja (`video_replay` broadcast); a válaszidő ettől nem
  áll meg.
- A szerkesztő a mentés előtt ellenőrzi, beágyazható-e a videó
  (`/admin/video`, YouTube oEmbed: 401 = a tulajdonos letiltotta, 404 = nem
  létezik vagy privát).
- „Videó teljes”: a klip alatt a videó tölti ki a kivetítőt, utána a kérdés
  látszik. „Videó + kérdés”: a videó végig a kérdés mellett marad.
