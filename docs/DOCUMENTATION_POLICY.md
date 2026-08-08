# Dokumentációs szabályzat

Minden fázis lezárásakor (PR leírásban vagy külön commitban):

1. Ha a fázis új táblát/oszlopot vezet be, vagy megváltoztat egy meglévő kapcsolatot:
   → frissítsd a `docs/architecture/DATA_MODEL.md` érintett szakaszát.
2. Ha a fázis új real-time eseményt vezet be vagy módosít egy meglévőt:
   → frissítsd a `docs/architecture/REALTIME_PROTOCOL.md`-t.
3. Ha a fázis egy önálló üzleti logikát vezet be (pl. pontszámítás, joker-szabály):
   → egy rövid (fél-egy oldalas) leírás a `docs/features/`-be.
4. Minden lezárt fázisról egy 2-3 soros bejegyzés a `docs/DECISIONS_LOG.md`-be:
   dátum, mit csináltunk, miért úgy döntöttünk (ha volt választási helyzet).

Nem cél a kimerítő, minden függvényt dokumentáló doksi — a cél, hogy fél év múlva
vissza lehessen nézni "miért van ez így", anélkül hogy a teljes kódot át kéne olvasni.

## UI konvenció: loading + hiba state minden aszinkron művelethez (Fázis N5)

Élő böngészős teszt mutatta meg, hogy loading/hiba visszajelzés nélkül egy
aszinkron művelet (form submit, adatlekérés, realtime szinkronizáció) a
felhasználó számára megkülönböztethetetlen egy hibától vagy egy elakadt
oldaltól. Mostantól minden **új** aszinkron művelethez kötelező mindkettő:

- **Form submit:** `use:enhance` a megosztott `$lib/toast-enhance.ts`
  `withToast()` helperrel (hiba → `svelte-sonner` toast; sikeres, nem
  redirectelő action esetén opcionális `successMessage`), a submit gomb
  pedig kapja meg a `Button.svelte` `loading` prop-ját egy helyi
  `$state`-tel vezérelve (`setSubmitting` callback a `withToast()`-nak).
  Redirectelő action-nél `successMessage`-t nem kell megadni (a toast
  sosem futna le a navigáció előtt), a `loading` állapot viszont akkor is
  hasznos (jelzi, hogy a kattintás elindult).
- **Kliens-oldali adatlekérés/szinkronizáció, ahol a "még nincs adat" és a
  "még töltődik" állapot vizuálisan összetéveszthető** (pl. realtime
  presence-alapú lista, ami üresen indul, mielőtt az első sync
  megérkezne) — explicit megkülönböztetés a UI-ban (pl. "Csapatok
  betöltése…" vs. "Még senki sem csatlakozott.", lásd
  `src/routes/host/[game_id]/+page.svelte`), ne csak egy "üres" állapot,
  ami a valós nulla találatot és a töltést egyaránt lefedi.

Ez a szabály a `/admin` felület CRUD form-jaira és minden hasonló,
felhasználói várakozást igénylő interakcióra vonatkozik — nem kell
loading state-et bevezetni triviálisan azonnali, SSR-ben már betöltött
tartalomra (a legtöbb `+page.server.ts` `load()`-dal töltött admin lista
nem "villan üresen", mert a HTML már betöltéskor tartalmazza az adatot).
