<script lang="ts">
	import TimerRing from './TimerRing.svelte';

	let {
		message = 'Kapcsolat helyreállítása…'
	}: {
		message?: string;
	} = $props();
</script>

<div class="reconnect-overlay" role="status">
	<TimerRing secondsLeft={0} duration={1} size={72} inactive />
	<p>{message}</p>
</div>

<style>
	.reconnect-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1rem;
		text-align: center;
		background: color-mix(in srgb, var(--cabinet) 85%, transparent);
		color: var(--marquee);
		font-family: var(--font-body);
	}
</style>
