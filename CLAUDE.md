# EquaCards — Pub Kvíz App

## Stack

- SvelteKit (TypeScript, `adapter-auto`)
- Supabase (Postgres, Auth, Realtime, Edge Functions) — `@supabase/supabase-js` + `@supabase/ssr`
- ESLint + Prettier, Husky + lint-staged pre-commit hook
- GitHub Actions CI (lint + `svelte-check` + build), Vercel git-integráció a deploy-hoz

## Mappastruktúra

```
/src
  /routes
    /admin            -- kérdésbank, felhasználók, globális beállítások
    /host/[game_id]    -- élő lebonyolítás
    /play/[pin]        -- csapat felület
    /tv/[game_id]      -- kivetítő, read-only
  /lib
    /server            -- Supabase server client, evaluate_answer hívások
    /realtime          -- broadcast csatorna wrapper (join, timer, események)
    /components        -- újrahasznosítható UI elemek
    /types             -- generált Supabase típusok + app-szintű típusok
supabase/migrations/    -- SQL migrációk, időbélyeg-prefixált fájlnevekkel
docs/
  architecture/DATA_MODEL.md         -- séma, egyetlen forrás igazság
  architecture/REALTIME_PROTOCOL.md  -- broadcast/presence események
  features/                          -- önálló üzleti logikák (pontozás, jokerek, ...)
  DOCUMENTATION_POLICY.md
  DECISIONS_LOG.md
```

## Séma

A teljes adatbázis-séma a `docs/architecture/DATA_MODEL.md`-ben van — ez az egyetlen
forrás igazság. Ne magyarázd újra a táblákat a promptokban, hivatkozz rá szakaszszám
szerint.

## Kódstílus

Kövesd a repóban lévő ESLint/Prettier configot (`eslint.config.js`,
`prettier.config.js`) — ne írj felül szabályokat prompt szinten. Conventional commits
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

## Dokumentáció

Minden fázis végén frissítsd az érintett `docs/architecture/*.md` /
`docs/features/*.md` fájlokat és írj egy rövid bejegyzést a
`docs/DECISIONS_LOG.md`-be — részletek: `docs/DOCUMENTATION_POLICY.md`.
