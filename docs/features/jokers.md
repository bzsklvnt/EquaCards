# Joker mechanika ("Duplázás")

## Cél

Egy kérdés aktív ideje alatt (a `timer_start` és a válaszok lezárása —
`answer_locked` vagy a helyi visszaszámlálás lejárta — között) egy csapat
egy estén **egyszer** aktiválhatja a "Duplázás" jokert az éppen futó
kérdésre. A tényleges pontszorzás (`joker_szorzó = 2`) a pontszámítás
része — a `evaluate_question` Postgres RPC számolja ki
(`docs/features/scoring.md`, `docs/architecture/DATA_MODEL.md` 3.
szakasz, "Pontszámítás a két szorzóval kombinálva"). Ez a dokumentum a
jokerhez tartozó adatmodellt és a csatlakozó broadcast-mechanikát írja le.

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

## A csapat kliense ír közvetlenül (Fázis O4 óta)

**Eredeti (Fázis 4-es) tervezés, és miért változott:** kezdetben a csapat
kliense csak egy `joker_activate` broadcast eseményt küldött a
`game:{game_id}` csatornán, a `team_joker_uses` sort pedig a **host**
(mint `authenticated`, `role_id in (1,2,3)` jogosultsággal rendelkező
kliens) írta be, a broadcast fogadásakor — mert a csapatok anonim
(`anon`) kliensek, és eredetileg nem volt rájuk anon insert policy.

Élő tesztelés (Fázis O4, lásd `docs/DECISIONS_LOG.md` és
`docs/features/scoring.md` "Fázis O4" szakasza) kimutatta, hogy ez a
minta egy valódi hibát okozott: a host-közvetített írás egy hálózati
kör-utazásos versenyhelyzetet (csapat → Supabase Realtime → host → DB
insert) vitt be a pontszámítás elé — ha a host gyorsan zárt/tárt fel egy
kérdést, vagy a broadcast késett/elveszett, a `team_joker_uses` sor még
nem létezett, amikor `evaluate_question()` lefutott, és a szorzó nem
érvényesült. A korábban itt dokumentált "ismert korlát" (host offline =
elveszett aktiválás) ugyanennek a tervezési hibának egy másik tünete volt.

**A jelenlegi megoldás:** a csapat kliense közvetlenül, szinkron ír a
`team_joker_uses`-be — ugyanaz a bizalmi modell, mint az
`answers_insert_anon_active_game` policy-nál (`device_token`-alapú
azonosítás, nem kriptográfiailag ellenőrzött tulajdonlás; a projekt már
dokumentált, elfogadott kompromisszuma egy ~40 fős baráti eseményhez, nem
új kockázat). Az új `team_joker_uses_insert_anon_active_game` RLS policy
(`supabase/migrations/20260808135500_joker_direct_insert.sql`) csak akkor
engedi be a sort, ha a csapat estéje `'active'`, ÉS a beszúrt
`question_id` egyezik a `games.current_question_id`-vel — egy manipulált
kliens így sem tud tetszőleges kérdésre utólag/előre jokert aktiválni.

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
**megvárja** a saját beszúrását, mielőtt a gombot eltünteti — nem
optimista UI, mert a beszúrás maga a forrás igazsága (nincs már
host-közvetítés, amit "meg kellene várni"):

```ts
const { error } = await supabase.from('team_joker_uses').insert({
	team_id,
	question_id,
	joker_type: 'double_points'
});
if (error) {
	// hibaüzenet a csapatnak, a gomb marad aktív — újrapróbálható
} else {
	jokerUsed = true;
	// a broadcast már csak a host UI-visszajelzésének szól
	await channel.send({
		type: 'broadcast',
		event: 'joker_activate',
		payload: { team_id, question_id, joker_type: 'double_points' }
	});
}
```

A host (`/host/[game_id]`) a csatornára feliratkozva fogadja a
broadcast-ot, de már **nem ír** a `team_joker_uses`-be — csak egy
állapot-üzenetet jelenít meg ("Joker aktiválva egy csapat által.") és
lejátssza a joker hangeffektet.

Az `unique (team_id, joker_type)` constraint továbbra is garantálja DB-
szinten, hogy egy csapat egy joker-típusból csak egyszer élhet — egy
második aktiválási kísérlet a beszúráskor hibát adna, amit a kliens most
már ténylegesen felismer és jelez (lásd fent), nem csendben elnyel.
