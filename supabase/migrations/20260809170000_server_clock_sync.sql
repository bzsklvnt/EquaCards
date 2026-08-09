-- Sürgősségi javítás — a Fázis P2 (host self:true broadcast-echo) csak a
-- host-és-a-többiek KÖZÖTTI, kézbesítési-késleltetésből eredő relatív
-- csúszást oldotta meg. A hiba a felhasználó szerint TOVÁBBRA IS fennáll
-- a /play és a /tv között — ennek a valódi gyökéroka más: a
-- games.current_question_started_at eddig a HOST KLIENSÉNEK saját,
-- helyi óráját (`new Date().toISOString()`, JS Date.now()) használta
-- forrásként. Ha a host eszközének rendszerórája akár csak pár
-- másodperccel eltér egy csapat telefonjának vagy a TV-eszköznek az
-- órájától (ami a valóságban gyakori — nem minden eszköz NTP-szinkronizált
-- pontosan ugyanarra az időre), MINDEN kliens ugyanahhoz az abszolút
-- időbélyeghez képest számol, de a SAJÁT, eltérő pontosságú
-- Date.now()-jával — ez pontosan azt a tünetet adja, amit a felhasználó
-- látott: a TV és a csapat órája nem egyezik, mert a két eszköz saját
-- órája nem egyezik EGYMÁSSAL SEM, nem csak a host-éval.
--
-- Megoldás: (1) a timer kezdő időbélyege mostantól a Postgres-szerver
-- `now()`-jából származik (nem a host kliens Date.now()-jából) — egyetlen,
-- közös, tekintélyelvű óraforrás minden kliens számára; (2) minden kliens
-- (host/play/tv) egy kis kalibrációs RPC-hívással (`server_now()`) méri
-- a SAJÁT Date.now()-ja és a Postgres-szerver órája közötti eltolást
-- (offset), és a visszaszámláláshoz a saját Date.now() helyett
-- `Date.now() + offset`-et használ — ez a klasszikus NTP-szerű
-- óra-szinkronizációs minta, ami eszköz-független, közös referenciaidőt ad.

-- server_now() — kis, olcsó RPC, amit minden kliens (anon is) meghívhat a
-- saját órája kalibrálásához.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

revoke execute on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;

-- start_question_timer() — a host ezzel indítja a timert: a szerver írja
-- be a kezdő időbélyeget (now()), és ugyanazt vissza is adja, hogy a host
-- pontosan azt a szerver-generált értéket broadcast-olja tovább, amit a
-- games sorba is beírt (nem egy külön, kliens-oldali időbélyeget).
create or replace function public.start_question_timer(p_game_id uuid, p_duration integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz;
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  update games
    set current_question_started_at = now(),
        current_question_duration_seconds = p_duration
    where id = p_game_id
    returning current_question_started_at into v_started_at;

  if not found then
    raise exception 'game_not_found';
  end if;

  return v_started_at;
end;
$$;

revoke execute on function public.start_question_timer(uuid, integer) from public;
revoke execute on function public.start_question_timer(uuid, integer) from anon;
grant execute on function public.start_question_timer(uuid, integer) to authenticated;
