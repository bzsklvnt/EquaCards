# Landing oldal, események és csapatregisztráció

Állapot: **kész** (nyilvános oldal, jelentkezés, várólista, lemondás,
e-mailek, kezelői felület). Az e-mailek a Resend beállításáig nem mennek ki.

## Döntések

- **„A” opció:** jelentkezés eseményenként, csapatonként egy űrlappal; nincs
  játékos-fiók.
- **Több helyszín:** `venues` tábla (`/admin/venues`); egy kvízeste = `games`
  sor `scheduled_at` + `venue_id` + `max_players` + `is_public` mezőkkel
  (DATA_MODEL.md 4. szakasz).
- **A létszámkorlát FŐBEN értendő** (pl. 40 fő egy este), nem csapatban. A
  csapat a jelentkezéskor megadja a létszámát (1–12 fő); a megerősített
  csapatok létszámának összege nem lépheti túl a `max_players`-t.
- **Várólista:** ha egy csapat létszáma már nem fér be, várólistára kerül.
  Lemondáskor (vagy a korlát emelésekor) a várólistát sorrendben nézzük végig,
  és mindenki bekerül, akinek a létszáma belefér (first-fit): egy nagy csapat
  nem tartja fel a mögötte álló kisebbeket, de amint neki is elég hely
  szabadul fel, ő jön először. A bekerült csapat e-mailt kap.
- **E-mail:** Resend (HTTP API, `src/lib/server/email.ts`). Ha nincs
  beállítva, a küldés kimarad; a jelentkezés ettől még sikeres.
- **Két domain, egy Vercel projekt:** `kocsmakvizest.hu` a nyilvános oldal,
  `app.kocsmakvizest.hu` a kezelő, a host, a csapatok és a kivetítő (lásd
  lent).

## Útvonalak

| Útvonal                                                              | Domain | Tartalom                                                            |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| `/`                                                                  | site   | bemutatkozás, közelgő esték (jelentkezhető), elmúlt esték (inaktív) |
| `/esemeny/[id]`                                                      | site   | esemény részletei + jelentkezési űrlap / visszaigazolás             |
| `/lemondas/[token]`                                                  | site   | lemondás megerősítő oldala (GET) és lemondás (POST)                 |
| `/adatkezeles`                                                       | site   | adatkezelési tájékoztató                                            |
| `/admin/games/[id]/event`                                            | app    | esemény adatai, megjelenés, jelentkezések, várólista                |
| `/admin/venues`                                                      | app    | helyszínek                                                          |
| minden más (`/admin`, `/host`, `/play`, `/tv`, `/login`, `/reports`) | app    |                                                                     |

A nyilvános oldal a `src/routes/(site)/` csoportban van, saját fix
palettával (DESIGN_SYSTEM.md „Nyilvános oldal”).

## Mikor látszik egy este a landing oldalon

| Lista                   | Feltétel                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Közelgő (jelentkezhető) | `is_public`, nem próbaeste, `status = 'lobby'`, `scheduled_at > now()`                                           |
| Elmúlt (inaktív)        | `is_public`, nem próbaeste, `scheduled_at <= now()` vagy már elindult / lezárult; lezárt estén a győztes neve is |

A jelentkezés a kezdésig automatikusan nyitva van. Ha a kezelő elrejti az
estét (`is_public = false`), a jelentkezés is megszűnik. Nyilvános estéhez
időpont kötelező.

## Jelentkezés életciklusa

```
register_team ──► confirmed ──(lemondás)──► cancelled
      │                                         │
      └──► waitlist ──(befér a létszáma)──► confirmed (promoted_at)
```

- `register_team` validál (név 1–40, létszám 1–12, e-mail formátum, telefon
  ≤ 30, megjegyzés ≤ 500), zárolja az estét, ellenőrzi a névütközést (a
  lemondott nevek újra szabadok), majd `confirmed` (ha a létszám befér) vagy
  `waitlist` státusszal szúr be. Visszaadja a `cancel_token`-t és a
  várólista-helyet. Hibakódok: `invalid_input`, `registration_closed`,
  `name_taken`.
- `cancel_registration(token)`: a token birtokosa (a visszaigazoló e-mail
  címzettje) mondhat le, a kezdésig. Hibakódok: `not_found`,
  `already_cancelled`, `too_late`. Visszaadja a bekerült jelentkezések
  azonosítóit (`promoted_ids`, nem az adataikat).
- `admin_cancel_registration(id)` → bekerültek azonosítói;
  `admin_promote_registration(id)` → kézi beengedés a korláttól függetlenül;
  `admin_fill_from_waitlist(game_id)` → a korlát emelése után (a kezelő
  mentéskor automatikusan hívja). Mind staff (1–3).
- A lemondás két lépéses (megerősítő oldal, majd POST), mert az
  e-mail-szolgáltatók linkellenőrzői megnyitják a leveleinkben lévő linkeket.
- Az űrlap botcsapdát (rejtett mező) és IP-alapú korlátot (8 jelentkezés / 10
  perc) használ.

## Csatlakozás az estén

A `/play/[pin]` a megerősített csapatok neveit (`registered_team_names`)
koppintható gombokként ajánlja fel, így a regisztrált csapat pontosan ugyanazzal
a névvel lép be.

## E-mailek (`src/lib/server/registrations.ts`)

| Esemény                                                                   | Levél                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Jelentkezés, befér                                                        | „Jelentkezés visszaigazolva” + lemondási link             |
| Jelentkezés, nem fér be                                                   | „Várólistára kerültetek” (hányadik hely) + lemondási link |
| Várólistáról bekerült (lemondás, korlát emelése vagy kézi beengedés után) | „Bekerültetek” + lemondási link                           |

A lemondási link mindig a nyilvános domainre mutat
(`PUBLIC_SITE_URL/lemondas/<cancel_token>`, ennek hiányában a kérés
originjére). Az előléptetett csapat e-mail címét az anonim lemondó kliense nem
olvashatja, ezért azt egy service-role kliens olvassa ki
(`src/lib/server/admin.ts`, csak szerveren). Kulcs nélkül a kezelői ágon a
kezelő saját kliense olvas (staff RLS), az anonim lemondás után pedig az
értesítő kimarad.

## Két domain (`src/hooks.server.ts`, `src/lib/site.ts`)

Ha a `PUBLIC_SITE_URL` és a `PUBLIC_APP_URL` is be van állítva:

- a landing domainre érkező, nem nyilvános útvonal (pl. `/admin`, `/play/…`)
  308-cal átirányul az app domainre;
- az app domainre érkező nyilvános útvonal (pl. `/esemeny/…`) a landing
  domainre;
- az app domain gyökere a kezelőt (auth süti esetén) a `/admin`-ra, a
  játékost a `/play` PIN-beíróra küldi.

Más hoston (Vercel preview, localhost) nincs átirányítás. Élőben tesztelve
Host-fejlécekkel (dev szerver, két tesztdomain).

## Adatmegőrzés

A `purge_old_registrations()` naponta (pg_cron, 03:17 UTC) törli azokat a
jelentkezéseket, amelyek estéje 30 napnál régebbi — ezt az adatkezelési
tájékoztató is vállalja.

## Környezeti változók (Vercel → Settings → Environment Variables)

| Név                         | Kötelező  | Leírás                                                           |
| --------------------------- | --------- | ---------------------------------------------------------------- |
| `PUBLIC_SITE_URL`           | élesben   | `https://kocsmakvizest.hu`                                       |
| `PUBLIC_APP_URL`            | élesben   | `https://app.kocsmakvizest.hu`                                   |
| `RESEND_API_KEY`            | e-mailhez | Resend API kulcs                                                 |
| `EMAIL_FROM`                | e-mailhez | pl. `Kocsmakvízest <kviz@kocsmakvizest.hu>`; hitelesített domain |
| `EMAIL_REPLY_TO`            | nem       | a válaszok címzettje (pl. a szervező címe)                       |
| `SUPABASE_SERVICE_ROLE_KEY` | ajánlott  | csak szerveren, soha nem `PUBLIC_`                               |

Az üzemeltető nevét, a kapcsolati e-mailt, a várost és az oldal nevét a
rendszergazda a `/admin/settings` oldalon adja meg (`site_*` kulcsok, anon
számára a `public_site_info()` adja ki).

## Ellenőrzés (élő adatbázison, rollback-kal lezárt tranzakcióban)

- 10 fős korlát: A (4) és B (5) bekerül, C (3) várólistára kerül (12 > 10),
  D (1) még befér (10), E (2) várólistára. B lemondása után C és E is bekerül
  (first-fit), a `public_event` 10/10 főt, 4 csapatot, üres várólistát mutat.
- Korábbi (csapat-alapú) teszt: dupla lemondás `already_cancelled`, a
  lemondott név újra szabad, a `registered_team_names` csak a megerősített
  csapatokat adja vissza, anon a kezelői függvényeket nem hívhatja (42501).
- Profil nélküli bejelentkezett felhasználót a kezelői és riport függvények
  elutasítják (42501); superadmin továbbra is eléri őket.
- A felület mock adattal, böngészőben ellenőrizve (asztali/mobil, üres lista,
  telt ház, várólista-visszaigazolás, hibaüzenet, elmúlt este, lemondás,
  kezelői oldal 1024/1440 px-en) — vízszintes görgetés sehol.
