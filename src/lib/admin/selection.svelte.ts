import { replaceState } from '$app/navigation';
import { page } from '$app/state';

// A kezelői listák kijelölése az URL-ben (?id=…): mély link és visszatöltés
// után is ugyanaz az elem nyílik meg — docs/features/admin-workspace.md.
export function createSelection(param = 'id', fallback: () => string | null = () => null) {
	let current = $state<string | null>(page.url.searchParams.get(param));

	return {
		get id(): string | null {
			return current ?? fallback();
		},
		set(id: string | null) {
			current = id;
			try {
				// eslint-disable-next-line svelte/prefer-svelte-reactivity -- egyszeri, nem reaktív másolat
				const url = new URL(page.url);
				if (id) url.searchParams.set(param, id);
				else url.searchParams.delete(param);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- a jelenlegi (már feloldott) URL, csak a ?paraméter változik
				replaceState(url, page.state);
			} catch {
				// a router még nem állt fel (első betöltés) — az URL-frissítés kimarad
			}
		}
	};
}
