import type { ShortcutGroup } from '$lib/components/ShortcutHelp.svelte';

// A kezelői felület közös billentyűzet-segédei (docs/features/admin-workspace.md).

/** Szövegbevitel közben az egybetűs parancsok nem élnek. */
export function isTypingTarget(el: EventTarget | null): boolean {
	if (!(el instanceof HTMLElement)) return false;
	if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
	if (el.tagName !== 'INPUT') return false;
	const type = (el as HTMLInputElement).type;
	return !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(type);
}

export function dialogOpen(): boolean {
	return typeof document !== 'undefined' && !!document.querySelector('dialog[open]');
}

/** Egy globális billentyű-kezelőnek akkor kell hallgatnia, ha nem gépelnek,
 * nincs nyitott ablak, és nincs módosító (Ctrl/Alt/Meta). */
export function plainKey(e: KeyboardEvent): boolean {
	return (
		!e.defaultPrevented &&
		!e.ctrlKey &&
		!e.metaKey &&
		!e.altKey &&
		!isTypingTarget(e.target) &&
		!dialogOpen()
	);
}

// Az aktuális oldal saját billentyűparancsai — a keret "?" súgója mutatja
// a globálisak mellett.
export const pageShortcuts = $state<{ groups: ShortcutGroup[] }>({ groups: [] });

export function registerPageShortcuts(getGroups: () => ShortcutGroup[]) {
	$effect(() => {
		const groups = getGroups();
		pageShortcuts.groups = groups;
		return () => {
			if (pageShortcuts.groups === groups) pageShortcuts.groups = [];
		};
	});
}
