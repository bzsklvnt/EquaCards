<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		type = 'button',
		disabled = false,
		loading = false,
		href,
		target,
		rel,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** Fázis N5 — submit közbeni vizuális jelzés; a gomb ilyenkor is
		 * disabled-ként viselkedik, hogy ne lehessen kétszer elküldeni. */
		loading?: boolean;
		href?: string;
		target?: string;
		rel?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const isDisabled = $derived(disabled || loading);
</script>

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- href is caller-supplied; callers must pass an already-resolve()d path for internal routes. -->
	<a
		{href}
		{target}
		{rel}
		class="btn {variant}"
		class:disabled={isDisabled}
		aria-disabled={isDisabled}
		{onclick}
	>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		{@render children()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button {type} disabled={isDisabled} class="btn {variant}" {onclick}>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1rem;
		border-radius: 0.5rem;
		padding: 0.6rem 1.25rem;
		min-height: 44px;
		min-width: 44px;
		/* Fázis O5 — lásd Input.svelte jegyzete: explicit border-box, hogy a
		   min-height ténylegesen a teljes renderelt magasságot jelentse,
		   Input/Select 44px-es min-height-jével egyező módon. */
		box-sizing: border-box;
		cursor: pointer;
		border: 2px solid transparent;
		text-decoration: none;
		transition:
			transform 0.1s ease,
			box-shadow 0.15s ease;
	}

	.btn:active:not(.disabled):not(:disabled) {
		transform: translateY(1px);
	}

	.btn:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.btn:disabled,
	.btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.primary {
		/* Fázis J — a natúr --violet fill csak 3.5:1 kontrasztot ad
		--marquee szöveggel (WCAG AA normál szöveg küszöb: 4.5:1); a
		--cabinet felé sötétített változat ~4.8:1-re javítja, a token
		magát változatlanul hagyva (a keret/glow más felhasználásoknál
		maradhat a fényes --violet). Fázis N3 — a --magenta a Button
		primary variánsából eltávolítva: az elsődleges gomb mindig tiszta
		lila, a magenta kizárólag a joker gombnál jelenik meg
		(src/routes/play/[pin]/+page.svelte .joker-wrap), hogy a szín
		vizuálisan egyértelműen a jokert jelezze mindenhol. */
		background: color-mix(in srgb, var(--violet) 80%, var(--cabinet));
		color: var(--marquee);
		border-color: var(--violet);
	}

	.primary:hover:not(:disabled):not(.disabled) {
		/* Sötétebb lila hover — ugyanaz a kontraszt-logika, csak
		erősebb --cabinet aránnyal, hogy a hover állapot vizuálisan
		elüljön az alapállapottól magenta bevonása nélkül. */
		background: color-mix(in srgb, var(--violet) 65%, var(--cabinet));
		box-shadow: 0 0 12px color-mix(in srgb, var(--violet) 50%, transparent);
	}

	.secondary {
		background: var(--cabinet-2);
		color: var(--marquee);
		border-color: var(--marquee-dim);
	}

	.secondary:hover:not(:disabled):not(.disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}

	.danger {
		background: color-mix(in srgb, var(--danger) 20%, var(--cabinet-2));
		color: var(--marquee);
		border-color: var(--danger);
	}

	.danger:hover:not(:disabled):not(.disabled) {
		/* Fázis J — natúr --danger fill csak 2.8:1-et adna --marquee-vel. */
		background: color-mix(in srgb, var(--danger) 65%, var(--cabinet-2));
	}

	.ghost {
		background: transparent;
		color: var(--marquee-dim);
		border-color: transparent;
	}

	.ghost:hover:not(:disabled):not(.disabled) {
		color: var(--cyan);
	}

	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		opacity: 0.8;
		animation: spin 0.6s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 1.6s;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
