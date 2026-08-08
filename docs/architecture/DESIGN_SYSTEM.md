# Design System

> **STATUS: IN PROGRESS.** Started in the post-review "Fázis F0" (style guide +
> component library) — see `NEXT_STEPS.md` (repo gyökér) és
> `docs/DECISIONS_LOG.md` a fázisonkénti bővítésekért.

## Forrás

A tényleges design tokenek egyetlen forrása a `design_themes` tábla
(`docs/architecture/DATA_MODEL.md` 8. szakasz, `docs/features/design-themes.md`)
— jelen dokumentum és a `docs/design/STYLE_GUIDE.html` a jelenlegi
alapértelmezett ("Retro Arcade") téma vizuális referenciája, nem egy attól
független, kőbe vésett paletta. Ha a seed változik, ezeket is frissíteni kell.

Élő, böngészőben megnyitható referencia: `docs/design/STYLE_GUIDE.html`.

## Szín-szerepek

| Token                                       | Szerep                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `--cyan`                                    | Elsődleges interaktív elem (kiválasztott állapot, fókusz-gyűrű, linkek) |
| `--power`                                   | Helyes válasz, pozitív visszajelzés, pontszám kiemelés                  |
| `--danger`                                  | Helytelen válasz, sürgető timer (utolsó 5 másodperc)                    |
| `--coin`                                    | PIN, rangsor-helyezés, kiemelt szám                                     |
| `--magenta`                                 | Joker, elsődleges gomb hover-állapota                                   |
| `--violet`                                  | Gomb-kitöltés (elsődleges gomb alapállapota)                            |
| `--cabinet` / `--cabinet-2` / `--cabinet-3` | Háttér-gradiens (sötéttől világosabb felé)                              |
| `--marquee`                                 | Elsődleges szöveg                                                       |
| `--marquee-dim`                             | Másodlagos szöveg, placeholder, inaktív elem                            |

**Szabály:** ne keveredjenek a szerepek — pl. `--danger` sose dekoratív
elem, csak hiba/sürgetés jelzésére. Ha egy komponensnek új szín-szerep
kellene, bővítsd ezt a táblázatot és a `design_themes` seedet együtt, ne
vezess be ad-hoc hex-kódot.

## Tipográfia

| Token            | Betűtípus      | Használat                                            |
| ---------------- | -------------- | ---------------------------------------------------- |
| `--font-display` | Press Start 2P | **Rövid** címek/kérdések — sose hosszú próza         |
| `--font-led`     | Silkscreen     | Minden szám-jellegű kijelzés: timer, pontszám, PIN   |
| `--font-body`    | Inter          | Minden más: gombszöveg, leírások, form mezők, listák |

## Arcade panel

A kártyaszerű felületek (kérdés-kártya, ranglista-kártya, PIN/QR panel)
alap mintája: `var(--cabinet-2)` háttér, `2px solid var(--violet)` keret,
`1rem` lekerekítés, finom scanline textúra (`repeating-linear-gradient`
vízszintes csíkokkal, ~3.5% opacitású fehér). Lásd
`docs/design/STYLE_GUIDE.html` "Arcade panel" szakasza az élő példáért.

## Komponens-könyvtár (`src/lib/components/`)

| Komponens             | Props                                                                                                    | Jegyzet                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `Button.svelte`       | `variant` (`primary`\|`secondary`\|`danger`\|`ghost`), `type`, `disabled`, `href`, `onclick`, `children` | `href` esetén `<a>`-ként renderel, egyébként `<button>`-ként            |
| `ChoiceButton.svelte` | `text`, `selected`, `disabled`, `onclick`                                                                | Egy/több-választós válasz-opció                                         |
| `TimerRing.svelte`    | `secondsLeft`, `duration`, `size`                                                                        | SVG körvisszaszámláló, `low` állapot (≤5 mp) pulzáló `--danger`-re vált |
| `PinDisplay.svelte`   | `pin`, `qrDataUrl`, `joinUrl`                                                                            | PIN + QR + csatlakozási URL egy arcade panelben                         |
| `TeamChip.svelte`     | `name`, `own`                                                                                            | Csapatnév pill-jelvény, `own` kiemeli a sajátot                         |
| `PodiumCard.svelte`   | `rank`, `name`, `score`, `scoreLabel`, `own`                                                             | Ranglista-sor, top 3-nál érem-emoji                                     |
| `Input.svelte`        | `label`, `name`, `type`, `value` (bindable), `placeholder`, `required`, `maxlength`                      | Label + input, min. 44px magasság érintéshez                            |
| `Select.svelte`       | `label`, `name`, `value` (bindable), `required`, `children`, `onchange`                                  | Label + select, `children` az `<option>` elemekhez                      |
| `Checkbox.svelte`     | `label`, `name`, `checked` (bindable), `value`                                                           | Label + checkbox, `accent-color: var(--cyan)`                           |

Minden komponens a legközelebbi `.cabinet` osztályú (vagy a design-token
`style` attribútumot hordozó) ős elemtől örökli a CSS custom property-ket —
nincs saját, beépített színkészletük, a `getActiveTokens()`/`tokensToCssText()`
(`src/lib/theme/tokens.ts`) alkalmazza őket a gyökér elemre.

## Fókusz és akadálymentesség

Minden interaktív komponens explicit `:focus-visible` stílust kap
(`outline: 3px solid var(--cyan)`), mert a sötét, neon-akcentú design
könnyen "eltünteti" a böngésző alapértelmezett fókusz-gyűrűjét. Az érintési
célpontok (gombok, checkbox, input) minimum 44×44px-esek.
