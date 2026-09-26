<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import { withToast } from '$lib/toast-enhance';

	// Kvízeste végleges törlése (csak rendszergazdának jelenik meg; a szerver és
	// az adatbázis is ellenőrzi). Az oldal `?/deleteGame` action-jét hívja.
	let {
		gameId,
		title,
		running = false,
		details = ''
	}: {
		gameId: string;
		title: string;
		/** Aktív / szüneteltetett estét nem lehet törölni. */
		running?: boolean;
		/** Pl. "3 csapat, 12 jelentkezés" — a megerősítő kérdésbe kerül. */
		details?: string;
	} = $props();

	let busy = $state(false);
</script>

<form
	method="POST"
	action="?/deleteGame"
	use:enhance={(input) => {
		const message = `Biztosan VÉGLEG törlöd a(z) „${title}” kvízestét?\n\nTörlődnek a körei, csapatai, válaszai és jelentkezései${details ? ` (${details})` : ''}; a jelentkezett csapatok NEM kapnak értesítést. A kérdések a kérdésbankban maradnak.\n\nEz nem vonható vissza.`;
		if (!confirm(message)) {
			input.cancel();
			return;
		}
		return withToast({ successMessage: 'Kvízeste törölve.', setSubmitting: (v) => (busy = v) })(
			input
		);
	}}
>
	<input type="hidden" name="game_id" value={gameId} />
	<Button type="submit" variant="danger" loading={busy} disabled={running}>Kvízeste törlése</Button>
</form>
