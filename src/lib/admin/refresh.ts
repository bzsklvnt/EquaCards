import { invalidate } from '$app/navigation';

type Update = (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;

/** Egy kezelői űrlap mentése után csak az oldal saját adatai töltődnek újra
 * (depends('app:page')), a közös layoutok (bejelentkezés-ellenőrzés, profil)
 * nem — így egy automatikus mentés után nem fut le fölöslegesen minden betöltő. */
export async function refreshPage(update: Update, opts: { reset?: boolean } = {}): Promise<void> {
	await update({ reset: opts.reset ?? true, invalidateAll: false });
	await invalidate('app:page');
}
