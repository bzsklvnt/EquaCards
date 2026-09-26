# Élesítés: domainek, e-mail, Supabase

Ellenőrző lista a `kocsmakvizest.hu` (nyilvános oldal) és az
`app.kocsmakvizest.hu` (kezelő, host, csapatok, kivetítő) indításához. A
DNS a Rackhostnál van, az e-mail küldés a Resenden megy. Az aktuális
állapotot a kezelőfelületen a **Beállítások → Élesítés állapota** panel
mutatja, ahol teszt e-mailt is lehet küldeni.

## 1. Vercel — domainek

Vercel → a projekt → **Settings → Domains**:

1. Add hozzá: `kocsmakvizest.hu`, `www.kocsmakvizest.hu` (állítsd
   átirányításra a `kocsmakvizest.hu`-ra) és `app.kocsmakvizest.hu`.
2. A Vercel minden domainnél kiírja a szükséges DNS rekordot (a fő
   domainnél általában egy `A` rekord, az aldomaineknél `CNAME`). Pontosan
   azt vidd fel a Rackhostnál, amit a Vercel mutat.
3. Akkor jó, ha mindhárom domain mellett „Valid Configuration” látszik.

## 2. Resend — domain hitelesítés (Rackhost DNS)

1. Resend → **Domains → Add Domain**: `kocsmakvizest.hu`. Régiónak az
   **Ireland (eu-west-1)**-et válaszd; az adatbázis is ott van.
2. A Resend 3–4 DNS rekordot kér (a pontos értékeket onnan másold):
   - `TXT` `resend._domainkey` — DKIM (hosszú kulcs);
   - `MX` `send` → `feedback-smtp.eu-west-1.amazonses.com`, prioritás 10;
   - `TXT` `send` → `v=spf1 include:amazonses.com ~all`;
   - ajánlott: `TXT` `_dmarc` → `v=DMARC1; p=none;`.
3. Rackhost ügyfélkapu → **Domainek → kocsmakvizest.hu → DNS-beállítások**
   (DNS zóna szerkesztése) → vedd fel a rekordokat.
   - A névnél általában elég a rövid alak (`send`, `resend._domainkey`). Ha a
     felület a teljes nevet kéri: `send.kocsmakvizest.hu`.
   - **A meglévő, `@` (fő domain) MX rekordokhoz ne nyúlj**: azok a
     rackhostos postafiókokat szolgálják ki. A Resend a `send` aldomaint
     használja, így a két rendszer nem zavarja egymást. A fő domain meglévő
     SPF rekordját se módosítsd.
4. Várj (pár perc, ritkán néhány óra), majd a Resendben nyomd meg a
   **Verify** gombot. Akkor jó, ha a domain állapota „Verified”.
5. Resend → **API Keys → Create API Key**: „Sending access”, domain:
   `kocsmakvizest.hu`. A kulcsot csak egyszer mutatja, másold ki.

## 3. Vercel — környezeti változók

Vercel → **Settings → Environment Variables**, a **Production**
környezethez:

| Név                         | Érték                                                        |
| --------------------------- | ------------------------------------------------------------ |
| `PUBLIC_SITE_URL`           | `https://kocsmakvizest.hu`                                   |
| `PUBLIC_APP_URL`            | `https://app.kocsmakvizest.hu`                               |
| `RESEND_API_KEY`            | a Resend API kulcs (`re_…`)                                  |
| `EMAIL_FROM`                | `Kocsmakvízest <kviz@kocsmakvizest.hu>`                      |
| `EMAIL_REPLY_TO`            | egy valódi rackhostos postafiók, pl. `info@kocsmakvizest.hu` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (titkos!)         |

- Az `EMAIL_FROM` címnek nem kell létező postafióknak lennie, de a
  domainje csak hitelesített (Verified) domain lehet. A csapatok válaszai az
  `EMAIL_REPLY_TO` címre érkeznek.
- **Fontos:** a változók csak új deploy után lépnek életbe: Deployments →
  a legfrissebb → „…” → **Redeploy**.

## 4. Supabase — bejelentkezés

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://app.kocsmakvizest.hu`
- **Redirect URLs:** `https://app.kocsmakvizest.hu/**`

A kezelői fiókok regisztrációs és jelszó-e-mailjeit a Supabase küldi, nem az
app. Ha ezeket is a saját domainről szeretnéd: Authentication → Emails →
SMTP Settings. Host: `smtp.resend.com`, port: `465`, user: `resend`,
jelszó: a Resend API kulcs, feladó: pl. `kviz@kocsmakvizest.hu`. A Supabase
beépített küldője óránként csak néhány levelet enged.

## 5. Az app beállításai

Kezelőfelület → **Beállítások**:

1. Töltsd ki: üzemeltető neve, kapcsolati e-mail, város. Az első kettő az
   adatkezelési tájékoztatóhoz kötelező.
2. Az „Élesítés állapota” panelen minden sor legyen ✓. Az „App domain”
   sornál a „!” azt jelzi, hogy nem az app domainen nyitottad meg az
   oldalt (ez nem hiba).
3. **Teszt e-mail küldése magamnak.** Ha hibát ír ki, a panel megmondja a
   valószínű okot:

| Üzenet                           | Teendő                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| „Nem ment ki: … nincs beállítva” | env változó hiányzik a Production környezetből, vagy nem volt Redeploy |
| `403 … domain is not verified`   | Resend domain-hitelesítés (2. lépés) nincs kész                        |
| `401` / `API key is invalid`     | rossz vagy törölt API kulcs; új kulcs, csere, Redeploy                 |
| `Invalid from field`             | `EMAIL_FROM` formátuma: `Név <cim@kocsmakvizest.hu>`                   |

A küldés részletei a Resend **Logs** oldalán, a szerver-oldali hibák a
Vercel **Logs** fülén (`[email]` sorok) láthatók.

## 6. Éles próba

1. Helyszín felvétele (Helyszínek).
2. Új kvízeste → Esemény fül: időpont a jövőben, helyszín, létszámkorlát
   (pl. 6 fő), Nyilvános ✓, Mentés.
3. A `kocsmakvizest.hu` kezdőlapján megjelenik → jelentkezés egy 4 fős
   csapattal → visszaigazoló e-mail.
4. Második jelentkezés 4 fővel → várólistás e-mail.
5. Az első e-mailben a lemondási link → lemondás → a második csapat
   „Bekerültetek” e-mailt kap, és az Esemény fülön megerősítettként látszik.
6. A kvízeste lezárása után a kezdőlapon az „Elmúlt esték” között jelenik
   meg.
