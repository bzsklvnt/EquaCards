# Felhasználó- és jogosultságkezelés (`/admin/users`)

## Cél

A review #1 admin-hézaga: minden role-váltás kézi SQL volt
(`update profiles set role_id = ...`) — a leginkább hiba-veszélyes kézi
művelet (elgépelt UUID, rossz `role_id`). Ez a dokumentum a `/admin/users`
felület megvalósítását írja le.

## Hozzáférés

Csak `role_id = 1` (super_admin) — az `/admin` layout guard-ja (1,2)
tágabb, ez a szűkítés route-szinten történik
(`src/routes/admin/users/+page.server.ts`), ugyanaz a minta, mint a
`/admin/settings`-nél (Fázis C).

## Email cím: honnan jön

A `profiles` tábla eddig nem tárolta az email címet, csak
`display_name`/`role_id`-t — az `auth.users.email` a védett `auth` sémában
van, amihez service-role kulcs kellene (nincs konfigurálva ebben az
appban, lásd `.env.example`). Ahelyett, hogy bevezetnénk egy service-role
klienst + admin API hívást (nagyobb biztonsági felület egy kis appban),
a már meglévő `handle_new_user()` trigger (Fázis 1) mostantól az email-t
is átmásolja a `public.profiles`-be signupkor — ugyanaz a minta, mint a
`display_name`-nél (`supabase/migrations/20260808131500_profiles_email.sql`).

**Ismert korlát:** ha egy felhasználó később megváltoztatja az email
címét az `auth.users`-ben, a `profiles.email` nem szinkronizálódik
automatikusan (nincs `UPDATE` trigger, csak `INSERT`-kor másolódik) —
ugyanez a korlát már eddig is fennállt a `display_name`-nél. MVP-szinten
elfogadható; ha valaha frissítés-szinkronra is szükség lenne, egy
`auth.users` `AFTER UPDATE` trigger pótolná.

## Role-váltás folyamata

- **Lista**: `profiles` tábla (`display_name`, `email`, `role_id`,
  `created_at`), a `roles` táblával (`id`, `code`, `label`) egy dropdown
  feltöltéséhez.
- **Váltás**: soronkénti `<form>` + `Select` komponens, `onchange`-re
  azonnal `requestSubmit()` — ugyanaz a "select auto-submit" minta, mint a
  `/admin/questions` téma-szűrőjénél és a host design-téma választójánál.
  A szerver action (`?/updateRole`) egyetlen `update profiles set role_id
= ... where id = ...` hívás, ami a meglévő `profiles_update_super_admin`
  RLS policy alá esik (`current_user_role_id() = 1`) — **nem kellett új
  RLS-t írni**, ez a policy már a Fázis 1 óta létezik pontosan erre a
  célra.
- **Önmagam lefokozása elleni védelem**: ha a bejelentkezett super_admin
  a saját `role_id`-ját próbálná 1-ről másra váltani, az action
  elutasítja ("Nem veheted el a saját rendszergazda jogosultságodat.") —
  **alkalmazás-szintű védelem, nem RLS**, mert ez nem jogosultság-kiszivárgás
  (a felhasználó a sajátját változtatná, amit egyébként jogosult lenne
  megtenni), hanem egy elkerülhető, önmagának okozott kizárás — pont az a
  fajta hiba, amit maga a Fázis B ki akar küszöbölni.
- **Naplózás**: minden role-váltás automatikusan bekerül az `audit_logs`-ba
  a Fázis 1-es `log_table_change()` triggeren keresztül — nem kellett
  extra kód hozzá.

## Visszajelzés

`svelte-sonner` toast (lásd "Csomag-döntés" lent) sikeres/sikertelen
role-váltásnál, `theme="dark"` + a retro arcade token-készlethez igazított
`toastOptions.style`. `use:enhance` egyéni callback-je dönti el
sikeres/hiba alapján, hogy `toast.success`/`toast.error` fusson-e — a
form emellett progresszív feljavítás nélkül (JS nélkül) is működik, a
hibaüzenet ilyenkor a hagyományos `form?.error` mezőn keresztül jelenik
meg egy `<p class="error">`-ban.

## Csomag-döntés: `svelte-sonner`, nem `svelte-french-toast`

A NEXT_STEPS.md `svelte-french-toast`-ot javasolt, de az a csomag
`peerDependencies`-e csak Svelte 3/4-et enged (`^3.57.0 || ^4.0.0`) — ez
az egész app Svelte 5 runes-alapú, egy `--legacy-peer-deps` kényszerítés
kockázatos lenne (a csomag valószínűleg Svelte 3/4-es komponens-API-t
használ, nincs garantálva, hogy helyesen működne Svelte 5 alatt). A
javaslat **szándéka** ("ne építs saját toast-rendszert") ettől független
teljesül a `svelte-sonner`-rel, ami explicit `svelte: "^5.0.0"` peer
dependency-vel rendelkezik.

## Csomag-döntés: nincs `sveltekit-superforms`/`zod`

A NEXT_STEPS.md ezt is javasolta a role-váltó form kezeléséhez, de a repo
egyetlen másik admin CRUD képernyője (`themes`, `questions`, `games`,
`design-themes`) sem használ superforms-ot — mindegyik natív SvelteKit
form action + kézi validáció mintát követ, `fail()`-lel visszaadott
hibaüzenetekkel. Egy darab, egyetlen mezős (role dropdown) form miatt
bevezetni egy új, a repóban máshol nem használt függőséget/mintát
inkonzisztenciát okozott volna a meglévő négy CRUD-képernyővel — ez
pontosan az az eset, amit a "csak akkor vezessünk be egy mintát, ha
ténylegesen ismétlődik/indokolt" elv (lásd `docs/architecture/DESIGN_SYSTEM.md`)
tanácsol elkerülni. A meglévő plain-form-action minta ugyanazt a
funkcionalitást adja, kevesebb új felülettel.
