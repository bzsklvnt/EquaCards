<script lang="ts">
	import { tourState } from '$lib/tours/state.svelte';
	import { startTour } from '$lib/tours/run';
	import { TOURS } from '$lib/tours/tours';

	let starting = $state(false);

	async function start() {
		const id = tourState.current;
		if (!id || starting) return;
		starting = true;
		try {
			await startTour(id);
		} finally {
			starting = false;
		}
	}
</script>

{#if tourState.current}
	<button
		type="button"
		class="tour-button"
		onclick={start}
		disabled={starting}
		title={`Bemutató: ${TOURS[tourState.current].title}`}
	>
		{#if !tourState.seen[tourState.current]}<span class="dot" aria-hidden="true"></span>{/if}
		Bemutató ▶
	</button>
{/if}

<style>
	.tour-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 36px;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		border: 2px solid var(--cyan, #35e7ff);
		background: var(--cabinet-2, #211640);
		color: var(--cyan, #35e7ff);
		font-family: var(--font-body, sans-serif);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.tour-button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cyan, #35e7ff) 18%, var(--cabinet-2, #211640));
	}

	.tour-button:focus-visible {
		outline: 3px solid var(--cyan, #35e7ff);
		outline-offset: 2px;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--magenta, #ff3e9a);
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}

	/* A driver.js buborékja a <body>-ba renderelődik, ezért globális
	   szelektorok; a színek az app Retro Arcade tokenjeit követik
	   (fix értékkel, mert a body-n nincsenek CSS változók). */
	:global(.driver-popover.equacards-tour) {
		background: #211640;
		color: #f5f0ff;
		border: 2px solid #35e7ff;
		border-radius: 12px;
		box-shadow: 0 0 24px rgb(53 231 255 / 25%);
		font-family: 'Inter', system-ui, sans-serif;
		max-width: min(360px, calc(100vw - 32px));
	}

	:global(.equacards-tour .driver-popover-title) {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 700;
		color: #35e7ff;
	}

	:global(.equacards-tour .driver-popover-description) {
		font-size: 0.9rem;
		line-height: 1.5;
		color: #f5f0ff;
	}

	:global(.equacards-tour .driver-popover-progress-text) {
		font-family: 'Silkscreen', monospace;
		color: #a79bc9;
	}

	:global(.equacards-tour .driver-popover-footer button) {
		text-shadow: none;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		border: 2px solid #9b5cff;
		background: #3a2470;
		color: #f5f0ff;
	}

	:global(.equacards-tour .driver-popover-footer button:hover),
	:global(.equacards-tour .driver-popover-footer button:focus) {
		background: #4b2f8f;
	}

	:global(.equacards-tour .driver-popover-close-btn) {
		color: #a79bc9;
	}

	:global(.equacards-tour .driver-popover-arrow-side-left.driver-popover-arrow) {
		border-left-color: #35e7ff;
	}

	:global(.equacards-tour .driver-popover-arrow-side-right.driver-popover-arrow) {
		border-right-color: #35e7ff;
	}

	:global(.equacards-tour .driver-popover-arrow-side-top.driver-popover-arrow) {
		border-top-color: #35e7ff;
	}

	:global(.equacards-tour .driver-popover-arrow-side-bottom.driver-popover-arrow) {
		border-bottom-color: #35e7ff;
	}
</style>
