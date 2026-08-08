# Realtime Protocol

> **STATUS: IN PROGRESS.** Filled in incrementally as each phase introduces or
> changes broadcast events — see `docs/DOCUMENTATION_POLICY.md`.

## Channels

- `game:{game_id}` — Supabase Realtime channel (broadcast + presence) egy adott
  kvízeste minden résztvevője (csapatok, host) között. A csapat/host kliens a
  játszott/vezetett game_id-jával csatlakozik hozzá.

## Events

### `team_joined` (Fázis 3)

- **Küldő:** csapat kliens (`/play/[pin]`), sikeres csatlakozás (a `teams`
  sor beszúrása) után.
- **Payload:** `{team_id, name}`
- **Kliens teendő:** host (`/host/[game_id]`) — a Presence-szel már úgyis
  élőben szinkronban lévő listát nem ez frissíti (arra a Presence `sync`
  eseménye szolgál), ez egy kiegészítő, egyszeri "csatlakozott" jelzés
  (pl. jövőbeli fázisban toast/hangeffekt).

Bekötve: `src/routes/play/[pin]/+page.svelte` küldi `channel.send({ type:
'broadcast', event: 'team_joined', payload: {...} })` formában, közvetlenül a
sikeres `track()` (lásd Presence lent) után.

_Következő fázisokban bővül:_ `question_show`, `timer_start`,
`joker_activate`, `answer_locked`, `question_reveal` — Fázis 4;
`round_leaderboard_reveal`, `final_leaderboard_reveal` — Fázis 5.

## Presence (Fázis 3)

A `game:{game_id}` csatorna Presence funkciója tartja élőben szinkronban,
mely csapatok vannak éppen csatlakozva — ez a host lobby nézet
(`/host/[game_id]`) élő csapatlistájának forrása, nem egy DB-lekérdezés.

**Csapat oldal** (`/play/[pin]`), sikeres csatlakozás után:

```ts
const channel = supabase.channel(`game:${gameId}`, {
	config: { presence: { key: teamId } }
});

channel.subscribe(async (status) => {
	if (status === 'SUBSCRIBED') {
		await channel.track({ team_id: teamId, name: teamName });
	}
});
```

**Host oldal** (`/host/[game_id]`), a lobby nézet betöltésekor:

```ts
const channel = supabase.channel(`game:${gameId}`, {
	config: { presence: { key: crypto.randomUUID() } } // a host saját kulcsa, nem kerül megjelenítésre
});

channel.on('presence', { event: 'sync' }, () => {
	const state = channel.presenceState<{ team_id: string; name: string }>();
	const teams = Object.values(state).flat(); // minden csatlakozott csapat aktuális állapota
});

channel.subscribe();
```

A Presence kulcsa csapat oldalon a `team_id` (így egy csapat egyetlen
bejegyzésként jelenik meg még akkor is, ha véletlenül több lapon van nyitva —
az utolsó `track()` felülírja az előzőt ugyanazon a kulcson), host oldalon egy
véletlen, csak a saját kapcsolatot azonosító kulcs (a host nem jelenik meg
csapatként a listában).

**Ismert korlátozás (Fázis 4-re halasztva):** a csapat oldali PIN-alapú
`games` lekérdezés csak `status = 'lobby'`-ra enged anon SELECT-et (lásd
`docs/architecture/DATA_MODEL.md` Fázis 3 implementációs jegyzete) — ha egy
csapat újratölti az oldalt azután, hogy a host elindította a játékot
(`status` már nem `'lobby'`), a jelenlegi PIN-alapú újracsatlakozás nem
működik. A `localStorage`-ban tárolt `team_id`/`game_id` alapján történő
újracsatlakozás a tényleges játékmenet UI-jával együtt, Fázis 4-ben épül meg.

## RLS-szint hozzáférés anonim (nem authentikált) klienseknek

A csapatok nem Supabase Auth session-nel csatlakoznak — a `device_token`
(kliens oldalon generált, `localStorage`-ban tárolt) adja az "azonosítást",
nem RLS-alapú sor-tulajdonlás. Ennek megfelelően:

- `games`: `anon` csak `status = 'lobby'` sorokat láthat (PIN feloldáshoz).
- `teams`: `anon` beszúrhat, ha a cél `games` sor `status = 'lobby'`; olvashat
  minden nem `'finished'` játékhoz tartozó csapatot.

Részletek: `docs/architecture/DATA_MODEL.md` 4. szakasz, "Implementáció
(Fázis 3)".
