# Landing oldal, események és csapatregisztráció

Állapot: **adatbázis + szerver-oldali szolgáltatás kész**; a felület (landing,
eseményoldal, lemondás, kezelői jelentkezés-lista) a látványterv
jóváhagyása után készül.

## Döntések

- **„A” opció:** jelentkezés eseményenként, csapatonként egy űrlappal; nincs
  játékos-fiók.
- **Több helyszín:** `venues` tábla; egy kvízeste = `games` sor
  `scheduled_at` + `venue_id` + `max_teams` + `is_public` mezőkkel
  (DATA_MODEL.md 4. szakasz).
- **Várólista:** betelt estére is lehet jelentkezni, a csapat várólistára
  kerül. Lemondáskor az első várólistás automatikusan bekerül, és e-mailt
  kap.
- **E-mail:** Resend (HTTP API, `src/lib/server/email.ts`). Ha nincs
  beállítva, a küldés kimarad; a jelentkezés ettől még sikeres.

## Mikor látszik egy este a landing oldalon

| Lista                   | Feltétel                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Közelgő (jelentkezhető) | `is_public`, nem próbaeste, `status = 'lobby'`, `scheduled_at > now()`                                           |
| Elmúlt (inaktív)        | `is_public`, nem próbaeste, `scheduled_at <= now()` vagy már elindult / lezárult; lezárt estén a győztes neve is |

A jelentkezés a kezdésig automatikusan nyitva van. Ha a kezelő elrejti az
estét (`is_public = false`), a jelentkezés is megszűnik.

## Jelentkezés életciklusa

```
register_team ──► confirmed ──(lemondás)──► cancelled
      │                                         │
      └──► waitlist ──(hely szabadul fel)──► confirmed (promoted_at)
```

- `register_team` validál (név 1–40, létszám 1–12, e-mail formátum, telefon
  ≤ 30, megjegyzés ≤ 500), zárolja az estét, ellenőrzi a névütközést (a
  lemondott nevek újra szabadok), majd `confirmed` vagy `waitlist`
  státusszal szúr be. Visszaadja a `cancel_token`-t és a várólista-helyet.
  Hibakódok: `invalid_input`, `registration_closed`, `name_taken`.
- `cancel_registration(token)`: a token birtokosa (a visszaigazoló e-mail
  címzettje) mondhat le, a kezdésig. Hibakódok: `not_found`,
  `already_cancelled`, `too_late`. Visszaadja az előléptetett jelentkezés
  azonosítóját (nem az adatait).
- `admin_cancel_registration(id)` / `admin_promote_registration(id)`: staff
  (1–3). A kézi előléptetés akkor hasznos, ha a kezelő megemelte a
  létszámkorlátot.

## E-mailek (`src/lib/server/registrations.ts`)

| Esemény                                                     | Levél                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Jelentkezés, van hely                                       | „Jelentkezés visszaigazolva” + lemondási link             |
| Jelentkezés, telt ház                                       | „Várólistára kerültetek” (hányadik hely) + lemondási link |
| Várólistáról bekerült (lemondás vagy kézi előléptetés után) | „Bekerültetek” + lemondási link                           |

A lemondási link: `<origin>/lemondas/<cancel_token>`. Az előléptetett csapat
e-mail címét az anonim lemondó kliense nem olvashatja, ezért azt egy
service-role kliens olvassa ki (`src/lib/server/admin.ts`, csak szerveren).
Kulcs nélkül a kezelői ágon a kezelő saját kliense olvas (staff RLS), az
anonim lemondás után pedig az értesítő kimarad.

## Környezeti változók (Vercel → Settings → Environment Variables)

| Név                         | Kötelező  | Leírás                                                        |
| --------------------------- | --------- | ------------------------------------------------------------- |
| `RESEND_API_KEY`            | e-mailhez | Resend API kulcs                                              |
| `EMAIL_FROM`                | e-mailhez | pl. `EquaCards Kvíz <kviz@domain.hu>`; hitelesített domainről |
| `EMAIL_REPLY_TO`            | nem       | a válaszok címzettje (pl. a szervező címe)                    |
| `SUPABASE_SERVICE_ROLE_KEY` | ajánlott  | csak szerveren, soha nem `PUBLIC_`                            |

## Ellenőrzés (élő adatbázison, rollback-kal lezárt tranzakcióban)

- Egy 1 fős estén: Alfa megerősített, Béta a várólista 1., Gamma a 2.
  helyre kerül. Alfa lemondása után Béta előlép (`promoted_at` kitöltve),
  a második lemondás `already_cancelled` hibát ad, az „Alfa” név újra
  szabad.
- A `registered_team_names` csak a megerősített csapatokat adja vissza.
- Anon a kezelői függvényeket nem hívhatja (42501), a táblát nem olvashatja.
- Profil nélküli bejelentkezett felhasználót a kezelői és riport függvények
  elutasítják (42501); superadmin továbbra is eléri őket.
