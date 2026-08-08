# PIN brute-force védelem

## Cél

A `games.pin` 6 jegyű (kb. 900 000 kombináció) — enélkül egy szkript
szekvenciálisan végigpróbálhatná a PIN-eket, és bejuthatna egy idegen
kvízestébe. Fázis M vezette be, a `NEXT_STEPS.md` 13. szakaszának 3.
pontja alapján.

## Mechanizmus

`src/lib/server/rate-limit.ts` — egyszerű, memóriabeli (nem elosztott)
IP-alapú számláló, `Map<string, number[]>` (kulcs → időbélyeg-lista adott
ablakon belül):

```ts
export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
	const now = Date.now();
	const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
	timestamps.push(now);
	attempts.set(key, timestamps);
	return timestamps.length > maxAttempts;
}
```

`src/routes/play/[pin]/+page.server.ts` **két ponton** hívja meg,
`getClientAddress()`-t használva kulcsként, 20 próbálkozás / 60 másodperc
küszöbbel:

1. **`load()`-ban** — ez a tényleges PIN-találgatási felület, mert minden
   `/play/[pin]` navigáció (a form beküldése nélkül is) elárulja, létezik-e
   az adott PIN-hez `lobby` állapotú este (`game: null` vs. tényleges
   adat).
2. **A `join` action-ben, függetlenül** — egy szkript közvetlenül
   POST-olhatna a `?/join` action-re a `load()` kihagyásával, tehát a
   `load()`-ra épülő védelem önmagában megkerülhető lenne.

Túllépés esetén a `load()` egy `error(429, ...)` hibát dob (ezt az újonnan
épített retro-stílusú `+error.svelte` jeleníti meg), a `join` action pedig
`fail(429, { error: ... })`-t ad vissza, amit a meglévő általános
`form?.error` hibamegjelenítés kezel a `/play/[pin]` oldalon — nem kellett
külön UI ág hozzá.

## Ismert korlátok

- **Nem elosztott** — Vercel serverless környezetben minden
  function-instance saját `Map`-et tart fenn, tehát több párhuzamos
  instance esetén a tényleges globális limit magasabb lehet a
  beállítottnál. Nincs Redis/DB-alapú megosztott számláló — ez tudatos
  kompromisszum, nem MVP-blokkoló egy ~40 fős baráti esemény
  léptékén, és a task leírása is elfogadott opcióként keretezte ("egyszerű
  IP/device-alapú számláló").
- **Megosztott IP mögötti csoportok** (pl. sok telefon ugyanazon a pub
  wifi NAT-ja mögött) elméletileg elérhetik a küszöböt gyors, egyidejű
  csatlakozáskor — a 20/60mp érték szándékosan bőkezű ehhez képest, de
  nem garantált, hogy soha nem üt be normál használat közben.
- A számláló sosem ürül explicit módon, csak lazy módon szűri a régi
  bejegyzéseket lekérdezéskor — hosszan futó szerver-instance esetén a
  `Map` mérete a valaha látott egyedi IP-k számával arányosan nő. Egy
  Vercel serverless function élettartama ezt gyakorlatban nem teszi
  problémává (az instance-ok maguk is újrateremtődnek).
