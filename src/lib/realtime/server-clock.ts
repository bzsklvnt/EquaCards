// Sürgősségi javítás — a Fázis P2 (host self:true broadcast-echo) csak a
// host-és-a-többiek közötti, hálózati kézbesítési késleltetésből eredő
// relatív csúszást oldotta meg. Élesben ez NEM oldotta meg teljesen a
// panaszt: a /play és a /tv órája továbbra sem egyezett. A valódi
// gyökérok: minden kliens (host, csapat, TV) a SAJÁT eszközének
// Date.now()-jával számolt a visszaszámláláshoz, a games.current_question_started_at
// pedig (a legutóbbi javítás előtt) a HOST kliens saját órájából származott
// — két külön hibaforrás egymásra rakódva: (1) a kliens-eszközök órája
// egymással sem feltétlenül egyezik pontosan, (2) a referencia-időbélyeg
// maga is egy (a többiekétől eltérő pontosságú) kliens órájából jött.
//
// Megoldás: (1) a games.current_question_started_at mostantól a Postgres-
// szerver now()-jából származik (`start_question_timer()` RPC), nem egy
// kliens órájából; (2) minden kliens ezzel a modullal kalibrálja a SAJÁT
// órájának eltolását (offset) a Postgres-szerver órájához képest — a
// klasszikus NTP-szerű minta: egy kis, gyors RPC-hívás (`server_now()`)
// előtt/után megmért Date.now()-okból becsüljük a hálózati kör-utazás
// felét, és ehhez képest számoljuk ki, mennyivel tér el a szerver órája a
// sajátunktól. A visszaszámláláshoz mostantól MINDENHOL `serverNow()`-t
// kell használni `Date.now()` helyett.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

let offsetMs = 0;

/**
 * Megméri a saját Date.now() és a Postgres-szerver órája közötti eltolást,
 * és eltárolja modul-szinten. Hívható többször (pl. minden felület
 * onMount-jában) — mindig felülírja a korábbi mérést egy frissebbel.
 */
export async function calibrateServerClock(supabase: SupabaseClient<Database>): Promise<void> {
	const t0 = Date.now();
	const { data, error } = await supabase.rpc('server_now');
	const t1 = Date.now();
	if (error || !data) return;

	const serverMs = new Date(data).getTime();
	const roundTripMs = t1 - t0;
	// A szerver válasza kb. a kör-utazás felénél (t0 + roundTrip/2)
	// keletkezett — ehhez a pillanathoz viszonyítjuk az akkor mért
	// szerver-időt, hogy a hálózati késleltetés fele ne torzítsa az
	// eltolást.
	//
	// Sürgősségi javítás — élő tesztelésből: a válasz-beküldés MINDEN
	// alkalommal 22P02 ("invalid input syntax for type integer")
	// Postgres-hibával hasalt el egy adott munkamenetben. Gyökérok:
	// `roundTripMs / 2` páratlan kör-utazási idő esetén .5-re végződő
	// törtszámot ad, ami innentől offsetMs-be, onnan MINDEN serverNow()
	// hívásba beépül — az `answers.answer_time_ms` (integer oszlop)
	// insert-je pedig ezt a törtszámot kapta meg. Mivel offsetMs csak
	// egyszer, onMount-kor kalibrálódik és utána a teljes munkamenetre
	// rögzül, ez NEM alkalmi/időszakos hiba volt, hanem az adott
	// munkamenet MINDEN beküldését elvitte, amíg a kör-utazás páratlan
	// volt kalibráláskor. Math.round() itt, a forrásnál zárja ki a
	// problémát — minden serverNow()-fogyasztó (visszaszámlálás,
	// answer_time_ms) garantáltan egész számot kap.
	offsetMs = Math.round(serverMs - (t0 + roundTripMs / 2));
}

/** `Date.now()` helyett használandó a visszaszámláláshoz mindenhol, ahol
 * a games.current_question_started_at (szerver-generált) időbélyeghez
 * képest kell hátralévő időt számolni. */
export function serverNow(): number {
	return Date.now() + offsetMs;
}
