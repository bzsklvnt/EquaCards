<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="arcade-panel">
	{@render children()}
</div>

<style>
	.arcade-panel {
		position: relative;
		background: var(--cabinet-2);
		border: 2px solid var(--violet);
		border-radius: 1rem;
		padding: 1.5rem;
		overflow: hidden;
	}

	.arcade-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.035) 0px,
			rgba(255, 255, 255, 0.035) 1px,
			transparent 1px,
			transparent 3px
		);
		pointer-events: none;
	}

	.arcade-panel > :global(*) {
		position: relative;
		z-index: 1;
	}
</style>
