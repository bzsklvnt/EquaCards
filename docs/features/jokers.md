# Joker mechanika ("Duplázás")

## Cél

Egy kérdés aktív ideje alatt (a `timer_start` és a válaszok lezárása —
`answer_locked` vagy a helyi visszaszámlálás lejárta — között) egy csapat
egy estén **egyszer** aktiválhatja a "Duplázás" jokert az éppen futó
kérdésre. A tényleges pontszorzás (`joker_szorzó = 2`) a pontszámítás
része — az az `evaluate_answer` Edge Function Fázis 5-ös feladata
(`docs/architecture/DATA_MODEL.md` 3. szakasz, "Pontszámítás a két
szorzóval kombinálva"). Ez a dokumentum a jokerhez tartozó adatmodellt és
a csatlakozó broadcast-mechanikát írja le.

## Adatmodell

```sql
create table team_joker_uses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  joker_type text not null default 'double_points',
  used_at timestamptz default now(),
  unique (team_id, joker_type)
);
```

Az `unique (team_id, joker_type)` garantálja DB-szinten, hogy egy csapat
egy adott joker-típusból csak egyszer élhet egy estén — a `teams` sor
eleve egy `games` sorhoz van kötve, tehát ez estén-belüli, nem globális
egyediség.

## Miért a host írja a `team_joker_uses`-t, nem a csapat kliense

A `docs/architecture/DATA_MODEL.md` 4. szakasza szerint a csapat kliense
csak egy `joker_activate` broadcast eseményt küld a `game:{game_id}`
csatornán; a `team_joker_uses` sort a **host** (mint `authenticated`,
`role_id in (1,2,3)` jogosultsággal rendelkező kliens) írja be, a
broadcast fogadásakor. Ez szándékos tervezési döntés:

- A csapatok anonim (`anon`) kliensek — a `team_joker_uses`-en nincs
  anon insert policy, csak `select` (hogy a saját kliensük betöltéskor el
  tudja dönteni, inaktívvá kell-e tenni a gombot). Ha a csapat kliense
  írhatna, egy manipulált kliens tetszőlegesen sokszor "aktiválhatná" a
  jokerét — a host-oldali írás a `role_id in (1,2,3)` RLS mögé teszi ezt.
- **Ismert korlát:** ez megköveteli, hogy a host böngészője éppen aktívan
  csatlakozva legyen a csatornához, amikor a joker_activate megérkezik —
  ha a host lapja épp nincs nyitva/csatlakozva, az adott aktiválás
  elveszik. Egy élő, jelenlévő kvízmesterrel futó pub-kvíz estén ez
  elfogadható kockázat (a host a teljes lebonyolítás alatt amúgy is a
  `/host/[game_id]` oldalon van); ha valaha megbízhatóbbá kellene tenni,
  egy szerver-oldali (Edge Function / Postgres trigger a broadcast helyett
  egy `insert`-en) megoldás váltaná ki ezt a mintát.

## Kliens oldali állapot

A csapat kliense (`/play/[pin]`) betöltéskor (illetve minden csatlakozáskor)
lekérdezi a saját `team_joker_uses` sorait:

```ts
const { data: uses } = await supabase
	.from('team_joker_uses')
	.select('id')
	.eq('team_id', teamId)
	.eq('joker_type', 'double_points')
	.maybeSingle();
```

Ha van találat, a "Duplázás" gomb nem jelenik meg. Aktiváláskor a kliens
optimistán (a host visszaigazolása nélkül) eltünteti a gombot — a tényleges
DB-írás a host oldalán, aszinkron történik:

```ts
await channel.send({
	type: 'broadcast',
	event: 'joker_activate',
	payload: { team_id, question_id, joker_type: 'double_points' }
});
```

A host (`/host/[game_id]`) a csatornára feliratkozva fogadja ezt, és
beírja a `team_joker_uses`-be:

```ts
channel.on('broadcast', { event: 'joker_activate' }, async ({ payload }) => {
	await supabase.from('team_joker_uses').insert({
		team_id: payload.team_id,
		question_id: payload.question_id,
		joker_type: payload.joker_type
	});
});
```

Az `unique (team_id, joker_type)` constraint miatt egy második aktiválási
kísérlet a beszúráskor hibát adna — ezt a host oldal jelenleg csendben
figyelmen kívül hagyja (a kliens úgyis csak egyszer küldi, mivel a gomb
eltűnik az első aktiválás után).

## Mi hiányzik még (Fázis 5)

- A tényleges pontszorzás: `joker_szorzó = 2, ha a csapat használt jokert
erre a question_id-ra` — az `evaluate_answer` Edge Function fogja
  kiszámolni, `left join team_joker_uses`-szel.
- Vizuális visszajelzés a csapatnak, hogy a jokerük ténylegesen rögzült-e
  (jelenleg csak optimista, host-oldali megerősítés nélküli UI van).
