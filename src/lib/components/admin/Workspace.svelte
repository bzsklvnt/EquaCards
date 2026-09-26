<script lang="ts">
	import type { Snippet } from 'svelte';

	// A kezelői felület közös háromoszlopos elrendezése (lista · részlet ·
	// műveletek) alul a billentyű-sávval — ugyanaz a minta, mint a
	// kvízösszerakóban. docs/features/admin-workspace.md.
	let {
		rail,
		main,
		side,
		keys = [],
		railWidth = '19rem',
		sideWidth = '21rem',
		label,
		fill = false
	}: {
		rail?: Snippet;
		main: Snippet;
		side?: Snippet;
		keys?: [string, string][];
		railWidth?: string;
		sideWidth?: string;
		label?: string;
		/** Egy flex-oszlop maradék magasságát tölti ki (pl. a kvízeste fejléce alatt). */
		fill?: boolean;
	} = $props();

	const columns = $derived(
		[rail ? railWidth : null, 'minmax(0, 1fr)', side ? sideWidth : null].filter(Boolean).join(' ')
	);
</script>

<div class="workspace" class:fill aria-label={label}>
	<div class="columns" style="grid-template-columns: {columns}">
		{#if rail}
			<aside class="rail">{@render rail()}</aside>
		{/if}
		<section class="main">{@render main()}</section>
		{#if side}
			<aside class="side">{@render side()}</aside>
		{/if}
	</div>
	{#if keys.length > 0}
		<footer class="keybar" aria-label="Billentyű-súgó">
			{#each keys as [key, text] (key + text)}
				<span><kbd>{key}</kbd> {text}</span>
			{/each}
			<span class="help"><kbd>?</kbd> összes parancs · <kbd>Ctrl K</kbd> keresés</span>
		</footer>
	{/if}
</div>

<style>
	.workspace {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - var(--topbar-h, 3.75rem));
		min-height: 0;
	}

	.workspace.fill {
		flex: 1;
		height: auto;
	}

	.columns {
		flex: 1;
		min-height: 0;
		display: grid;
	}

	.rail,
	.side {
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: var(--cabinet-2);
	}

	.rail {
		border-right: 1px solid var(--panel-border, #e4ded2);
	}

	.side {
		overflow-y: auto;
		gap: 0.9rem;
		padding: 1rem 1.1rem;
		border-left: 1px solid var(--panel-border, #e4ded2);
	}

	.main {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: 1.25rem 1.6rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.keybar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 1.1rem;
		min-height: 2.25rem;
		box-sizing: border-box;
		padding: 0.3rem 1.2rem;
		background: var(--marquee);
		color: color-mix(in srgb, var(--cabinet-2) 80%, var(--marquee));
		font-size: 0.78rem;
	}

	.keybar kbd {
		font-family: ui-monospace, monospace;
		color: var(--cabinet-2);
	}

	.help {
		margin-left: auto;
	}

	@media (max-width: 1100px) {
		.columns {
			grid-template-columns: minmax(0, 15rem) minmax(0, 1fr) !important;
		}

		.side {
			grid-column: 1 / -1;
			border-left: 0;
			border-top: 1px solid var(--panel-border, #e4ded2);
		}

		.workspace {
			height: auto;
		}
	}

	@media (max-width: 720px) {
		.columns {
			grid-template-columns: minmax(0, 1fr) !important;
		}

		.rail {
			max-height: 45dvh;
			border-right: 0;
			border-bottom: 1px solid var(--panel-border, #e4ded2);
		}

		.main {
			padding: 1rem;
		}

		.keybar {
			display: none;
		}
	}
</style>
