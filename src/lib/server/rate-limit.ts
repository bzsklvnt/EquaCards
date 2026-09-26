// Egyszerű, memóriabeli (nem elosztott) IP-alapú rate limit — Vercel
// serverless környezetben instance-onként külön számol, tehát nem tökéletes
// védelem, de hatékony gát a szekvenciális PIN-találgatás ellen egyetlen
// kapcsolódás mögül. Lásd docs/DECISIONS_LOG.md "MVP KÉSZ" bejegyzés.
const attempts = new Map<string, number[]>();
const MAX_KEYS = 5000;

function recent(key: string, windowMs: number, now: number): number[] {
	return (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
}

// A lejárt bejegyzések időnként kitakarítva, hogy a memória ne nőjön a végtelenségig.
function prune(now: number, windowMs: number) {
	if (attempts.size < MAX_KEYS) return;
	for (const [key, stamps] of attempts) {
		if (stamps.every((t) => now - t >= windowMs)) attempts.delete(key);
	}
}

/** Minden hívás egy próbálkozás; igaz, ha a kulcs túllépte a keretet. */
export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
	const now = Date.now();
	prune(now, windowMs);
	const timestamps = recent(key, windowMs, now);
	timestamps.push(now);
	attempts.set(key, timestamps);
	return timestamps.length > maxAttempts;
}

/** Csak a sikertelen próbálkozások számítanak (lásd recordFailure) — egy
 * kocsma közös IP-je mögül a sikeres csatlakozások nem fogyasztják a keretet. */
export function tooManyFailures(key: string, maxFailures: number, windowMs: number): boolean {
	return recent(key, windowMs, Date.now()).length >= maxFailures;
}

export function recordFailure(key: string, windowMs: number): void {
	const now = Date.now();
	prune(now, windowMs);
	const timestamps = recent(key, windowMs, now);
	timestamps.push(now);
	attempts.set(key, timestamps);
}
