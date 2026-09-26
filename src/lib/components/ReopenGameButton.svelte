<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import { withToast } from '$lib/toast-enhance';

	// Lezárt kvízeste újranyitása (Váró állapotba) — az oldal `?/reopen`
	// action-jét hívja, lásd reopenGameAction() ($lib/server/games.ts).
	let { gameId }: { gameId: string } = $props();

	let busy = $state(false);
</script>

<form
	method="POST"
	action="?/reopen"
	data-tour="game-reopen"
	use:enhance={withToast({
		successMessage: 'Kvízeste újranyitva — a Váró állapotból indítható újra.',
		setSubmitting: (v) => (busy = v)
	})}
>
	<input type="hidden" name="game_id" value={gameId} />
	<Button type="submit" variant="secondary" loading={busy}>Kvízeste újranyitása</Button>
</form>
