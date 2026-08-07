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
