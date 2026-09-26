<script lang="ts">
	import type { SaveState } from '$lib/admin/autosave.svelte';

	let { state, error = '' }: { state: SaveState; error?: string } = $props();
</script>

{#if state === 'saving'}<span class="ws-saved busy">Mentés…</span>
{:else if state === 'dirty'}<span class="ws-saved busy">● Nem mentett változás</span>
{:else if state === 'error'}<span class="ws-saved error" title={error}
		>● {error || 'Mentési hiba'}</span
	>
{:else}<span class="ws-saved">● Mentve</span>{/if}
