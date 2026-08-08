# Decisions Log

Rövid, dátumozott bejegyzések minden lezárt fázisról: mi történt, és miért úgy
döntöttünk, ha volt választási helyzet. Lásd `docs/DOCUMENTATION_POLICY.md`.

---

## 2026-08-07 — Fázis 0: Projekt-váz + CI/CD + docs skeleton

Létrehozva: SvelteKit projekt (`sv create`, TypeScript, `adapter-auto`) Prettier +
ESLint add-onokkal, `@supabase/supabase-js` + `@supabase/ssr` csomagok és egy alap
szerver-oldali Supabase kliens (`src/lib/server/supabase.ts`, `src/hooks.server.ts`) —
maga az auth flow és a route guard Fázis 1-ben készül el. Husky + lint-staged
pre-commit hook (ESLint `--fix` + Prettier a stage-elt fájlokon). A teljes
`/src` route/lib mappaváz és a `supabase/migrations/` üres mappa. `docs/` skeleton
(`architecture/`, `features/`, `DOCUMENTATION_POLICY.md`, `DECISIONS_LOG.md`).
`.github/workflows/ci.yml` (lint + `svelte-check` + build, PR-onként `main`-re).
Gyökér `CLAUDE.md`.

Nyitott pont: a `docs/architecture/DATA_MODEL.md` egyelőre placeholder — a forrás
`PUB_QUIZ_APP_TERV.md` nem volt elérhető ebben a sessionben. Fázis 1 előtt pótolni
kell, mert minden további fázis prompt erre hivatkozik szakaszszám szerint.

## 2026-08-07 — DATA_MODEL.md véglegesítve

A `PUB_QUIZ_APP_TERV.md` tartalma bekerült a `docs/architecture/DATA_MODEL.md`-be
(teljes séma: jogosultságok, kérdésbank, válaszok, games/teams/rounds, real-time
protokoll séma-oldala, audit log, felület-áttekintés, MVP fázisok). A gyökérben lévő
`PUB_QUIZ_APP_TERV.md` törölve — a `docs/architecture/DATA_MODEL.md` az egyetlen
forrás igazság, nem tartunk két helyen duplikált másolatot. Fázis 1 innentől indítható.

## 2026-08-08 — Fázis 1: Jogosultság + admin váz + audit log

Migráció (`supabase/migrations/20260807234850_roles_profiles_audit.sql`):
`roles`/`profiles` a DATA_MODEL.md 1. szakasza szerint, `audit_logs` +
`log_table_change()` trigger a 6. szakasza szerint, rákötve a `profiles`
táblára. Ezen felül (nem volt explicit SQL a tervben, indoklás a
DATA_MODEL.md 1. szakaszának "Implementáció" alszakaszában): `handle_new_user()`
trigger az `auth.users`-en (automatikus `profiles` sor létrehozás, alap
`role_id = 4`), `current_user_role_id()` segédfüggvény a rekurzív RLS
elkerülésére, és konkrét RLS policy-k a `roles`/`profiles`/`audit_logs`
táblákon. A migrációt közvetlenül a Supabase MCP-n keresztül alkalmaztam az
éles (üres) `PubQuiz` projektre (`wnmgilblkdqunhpwoulj`); a security/performance
advisorok által jelzett problémákat (mutable search_path, anon/authenticated
RPC-elérés a trigger-függvényeken, `auth.uid()` újrakiértékelése soronként)
kijavítottam és belefésültem az egyetlen migrációs fájlba, mielőtt commitoltam
— nem hagytam a "hiba, majd 2 javító migráció" történetet a repóban, mivel ezt
még senki más nem húzta le.

Supabase auth: email/jelszó, `@supabase/ssr` szerinti szabványos SvelteKit
minta (`+layout.server.ts` + `+layout.ts` + `+layout.svelte` session-szinkron,
`src/lib/supabase.ts` böngésző-kliens). `/login` (bejelentkezés + regisztráció
egy oldalon, mód-váltóval), `/logout` (`+server.ts` POST action).
`/admin/+layout.server.ts` route guard: bejelentkezés nélkül `/login`-ra
irányít, `role_id` 1/2 (super_admin/admin) nélkül 403-at ad.

Az auth-folyamatot élő böngészőben csak részben tudtam tesztelni: ennek a
sandboxnak az egress-proxy szabályzata policy-szinten (403) blokkolja a
kimenő kapcsolatot a `*.supabase.co` felé, így a tényleges signup/login hívás
nem futott le helyben (ez a sandbox hálózati korlátja, nem a kódé — a Vercel
preview deploy nincs e mögött a proxy mögött, ott működnie kell). Amit
ellenőriztem: a build/lint/typecheck tiszta, a form action helyesen építi fel
és küldi a kérést (a hálózati hívás pontosan itt bukott el, kódszinten nem),
és a DB-oldalt közvetlenül SQL-lel (`pg_trigger`, `pg_policies`) + a Supabase
security/performance advisorokkal igazoltam vissza.
