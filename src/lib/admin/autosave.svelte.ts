import type { SubmitFunction } from '@sveltejs/kit';
import { untrack } from 'svelte';

// Kezelői űrlapok automatikus mentése: a mezők változása után (késleltetve)
// maga küldi be az űrlapot a meglévő form action-re — docs/features/admin-workspace.md.
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export function createAutosave(opts: {
	snapshot: () => string;
	submit: () => void;
	delay?: number;
	onSaved?: (data: Record<string, unknown> | undefined) => void;
}) {
	let state = $state<SaveState>('saved');
	let error = $state('');
	let last = untrack(opts.snapshot);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const current = opts.snapshot();
		if (current === last) return;
		state = 'dirty';
		clearTimeout(timer);
		timer = setTimeout(opts.submit, opts.delay ?? 800);
	});

	const enhance: SubmitFunction = () => {
		clearTimeout(timer);
		last = opts.snapshot();
		state = 'saving';
		return async ({ result, update }) => {
			if (result.type === 'success') {
				state = opts.snapshot() === last ? 'saved' : 'dirty';
				error = '';
				opts.onSaved?.(result.data);
			} else if (result.type === 'failure') {
				state = 'error';
				error = (result.data?.error as string) ?? 'Nem sikerült menteni.';
			} else if (result.type === 'error') {
				state = 'error';
				error = 'Váratlan hiba történt.';
			}
			await update({ reset: false });
		};
	};

	return {
		get state() {
			return state;
		},
		get error() {
			return error;
		},
		/** Új elem betöltésekor: a jelenlegi mezők számítanak mentettnek. */
		reset() {
			clearTimeout(timer);
			last = opts.snapshot();
			state = 'saved';
			error = '';
		},
		/** Váltás előtt: a függő mentés azonnal elmegy. */
		flush() {
			if (state === 'dirty') opts.submit();
		},
		enhance
	};
}
