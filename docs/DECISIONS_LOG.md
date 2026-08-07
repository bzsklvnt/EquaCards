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
