import type { TourId } from './tours';

const SEEN_PREFIX = 'equacards:tour-seen:';

// Az éppen megnyitott oldal bemutatója (a "Bemutató ▶" gomb ezt indítja) és
// böngészőnként, hogy melyiket nézték már meg (villogó jelzőpont a gombon).
export const tourState = $state<{ current: TourId | null; seen: Partial<Record<TourId, boolean>> }>(
	{ current: null, seen: {} }
);

function readSeen(id: TourId): boolean {
	try {
		return localStorage.getItem(SEEN_PREFIX + id) === '1';
	} catch {
		return false;
	}
}

export function markTourSeen(id: TourId) {
	tourState.seen[id] = true;
	try {
		localStorage.setItem(SEEN_PREFIX + id, '1');
	} catch {
		// privát ablak / tiltott tárhely — a jelzőpont ilyenkor csak ebben a munkamenetben tűnik el
	}
}

/** Oldal-komponensben hívandó: bejelenti, melyik bemutató tartozik az oldalhoz. */
export function registerPageTour(getId: () => TourId | null) {
	$effect(() => {
		const id = getId();
		tourState.current = id;
		if (id) tourState.seen[id] = readSeen(id);
		return () => {
			if (tourState.current === id) tourState.current = null;
		};
	});
}
