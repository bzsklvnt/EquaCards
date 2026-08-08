// Egyszerű, memóriabeli (nem elosztott) IP-alapú rate limit — Vercel
// serverless környezetben instance-onként külön számol, tehát nem tökéletes
// védelem, de hatékony gát a szekvenciális PIN-találgatás ellen egyetlen
// kapcsolódás mögül. Lásd docs/DECISIONS_LOG.md "MVP KÉSZ" bejegyzés.
const attempts = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
	const now = Date.now();
	const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
	timestamps.push(now);
	attempts.set(key, timestamps);
	return timestamps.length > maxAttempts;
}
