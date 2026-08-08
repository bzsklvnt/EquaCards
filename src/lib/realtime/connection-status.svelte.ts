// Megosztott kapcsolat-állapot a host header (Fázis F) számára — a
// `game:{game_id}` csatornát a page komponens birtokolja (üzleti logika),
// de az állapotát a layout header jeleníti meg. Svelte context hidalja át
// a layout → page hierarchiát (a page nem tud propokat küldeni a szülő
// layout-nak, csak context-en keresztül).
import { getContext, setContext } from 'svelte';

const KEY = Symbol('connection-status');

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export class ConnectionStatusStore {
	status: ConnectionStatus = $state('disconnected');
}

export function setConnectionStatusContext(): ConnectionStatusStore {
	const store = new ConnectionStatusStore();
	setContext(KEY, store);
	return store;
}

export function getConnectionStatusContext(): ConnectionStatusStore {
	return getContext(KEY);
}
