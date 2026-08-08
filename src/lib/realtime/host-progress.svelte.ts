// Kör/kérdés progress a host header (Fázis F) számára — ugyanaz a
// context-minta, mint a connection-status.svelte.ts-nél.
import { getContext, setContext } from 'svelte';

const KEY = Symbol('host-progress');

export class HostProgressStore {
	roundTitle: string = $state('');
	current: number | null = $state(null);
	total: number | null = $state(null);
}

export function setHostProgressContext(): HostProgressStore {
	const store = new HostProgressStore();
	setContext(KEY, store);
	return store;
}

export function getHostProgressContext(): HostProgressStore {
	return getContext(KEY);
}
