import type { SaveState } from './autosave.svelte';

// Az aktuális oldal automatikus mentésének állapota — a kezelői keret
// oldalsó menüjének tetején jelenik meg (összecsukva zöld / sárga / piros
// pötty), nem az oldal saját fejlécében, így a felirat hossza nem tolja el
// a fejléc gombjait (docs/features/admin-workspace.md).
export const saveStatus = $state<{ state: SaveState | null; error: string }>({
	state: null,
	error: ''
});

/** Az oldal komponens-inicializálásakor hívandó: amíg az oldal él, az
 * állapota a keretben látszik; távozáskor a kijelzés alaphelyzetbe áll. */
export function registerSaveStatus(get: () => { state: SaveState; error?: string }) {
	$effect(() => {
		const current = get();
		saveStatus.state = current.state;
		saveStatus.error = current.error ?? '';
	});
	$effect(() => () => {
		saveStatus.state = null;
		saveStatus.error = '';
	});
}
