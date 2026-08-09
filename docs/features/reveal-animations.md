# Megoldás-feltárás vizuális feldúsítása — host/TV (Fázis P6)

## Cél

A `question_reveal` esemény korábban a host/TV felületen is csak szöveges
formában ("Helyes válasz: A, C") jelent meg — ugyanaz a formázott string,
amit a `docs/architecture/REALTIME_PROTOCOL.md` `QuestionRevealPayload`-ja
mindig is tartalmazott. Ez a fázis kizárólag a **host és a TV** nézetet
teszi látványosabbá, típusonként a válasz-UI-hoz hasonló, de nem
interaktív, animált vizuál megjelenítésével. **A csapatok saját telefonján
(`/play`) szándékosan nem változott semmi** — ott marad az egyszerű saját
helyes/helytelen + pontszám visszajelzés (`docs/features/game-experience-polish.md`
"6. Válaszbeküldés típusonként" szakasza), mert a `/play`-en a saját
eredmény a releváns, nem a teljes opció-lista újramutatása.

## Kibővített `QuestionRevealPayload` (`src/lib/realtime/protocol.ts`)

A payload eddig csak egy előre formázott `correct_answer` stringet
tartalmazott. Reveal-kor (nem előtte!) már biztonságosan nyilvános a
strukturált adat is, ezért három új, típus szerint pontosan egy kitöltött
opcionális mező került bele:

- `correct_option_ids?: string[]` — `single_choice`/`multi_choice`/
  `true_false`.
- `correct_value?: number` — `slider`.
- `correct_order?: { id, item_text }[]` — `ordering`, helyes sorrendben.

A host `revealAnswer()`-je (`/host/[game_id]/+page.svelte`) már eddig is
lekérdezte ezeket az adatokat a `correct_answer` string összeállításához
(`question_choice_options.is_correct`, `question_slider_config.correct_value`,
`question_ordering_items.correct_position`) — csak korábban nem küldte
tovább strukturáltan, csak a formázott szöveget.

## `QuestionRevealVisual.svelte` (közös komponens)

Mind a host, mind a TV pontosan ugyanazt a feltárás-vizuált kell mutassa
(csak méretben térhet el), ezért egy közös, újrahasznosítható komponens
végzi a renderelést:

- **`single_choice`/`multi_choice`/`true_false`**: a `currentQuestion.options`
  (amit mindkét felület már eddig is megkapott a `question_show`
  broadcast-tal, csak korábban nem jelenítette meg) `ChoiceButton`-okként
  renderelődik, `disabled` + `correct={id ∈ correct_option_ids}` — a
  `ChoiceButton` új `correct` variánsa `var(--power)` zöld keret/háttér +
  egy rövid, pulzáló "bekerülési" animáció + egy ✓ jelet ad, a többi
  (helytelen) opció változatlan stílusban marad.
- **`slider`**: egy letiltott `<input type="range">`, aminek az értékét
  egy Svelte `Tween` (`svelte/motion`) animálja a tartomány közepéről
  (kiinduló, semleges pozíció — a csapatok EGYEDI beküldött értékei nem
  publikusak, `docs/architecture/DATA_MODEL.md` 5. szakasz "senki se lásson
  mást" elve) a helyes értékre, 700ms alatt, `cubicOut` easing-gel — a
  `<input>` `value`-jának gyors, ismételt (Tween-tick-enkénti) írása adja a
  natív thumb simán mozgó vizuálját.
- **`ordering`**: a kérdés alatt már megjelenített, kevert sorrendű
  `ordering_items` lista jelenik meg elsőként (demonstrációs kiinduló
  állapot — az egyedi csapat-beküldések itt sem publikusak), majd 400ms
  után a helyes sorrendre vált — a `{#each}` `animate:flip`-je (Svelte
  beépített FLIP-támogatása) automatikusan animálja az elemek
  pozíció-cseréjét, nem kellett kézzel implementálni.

## Bekötés host/TV oldalon

- **Host** mostantól saját maga is megtartja a `question_show` payload-ot
  (`currentQuestion` state) — korábban a host felület egyáltalán nem
  jelenítette meg az opciókat/csúszkát/sorrendet, csak a promptot és a
  vezérlő gombokat, tehát ehhez a fázishoz ez is új.
- **TV**: a `revealInfo` ág (`{:else if revealInfo}`) mostantól a meglévő
  `currentQuestion`-t (ami a `round_leaderboard_reveal`-ig megmarad) adja
  át a komponensnek; ha valamiért `currentQuestion` mégis hiányzik
  (pl. egy TV-oldali reconnect edge-case), a régi, egyszerű szöveges
  visszaesés marad meg védőhálóként.

## Szándékos scope-határ

A TV a KÉRDÉS ÉLŐ megjelenítésekor (a `timing`/`locked` fázisban) továbbra
sem mutatja az opciókat/csúszkát/sorrendet ugyanígy — ez a Fázis P7
("TV mód kérdés-megjelenítés egységesítése a játékos-nézettel") feladata,
ami az itt bevezetett vizuális elemeket a KÉRDÉS teljes élettartamára
kiterjeszti majd, nem csak a feltárásra.
