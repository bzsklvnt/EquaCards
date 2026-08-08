<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		type = 'button',
		disabled = false,
		href,
		target,
		rel,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		href?: string;
		target?: string;
		rel?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is caller-supplied; callers must pass an already-resolve()d path for internal routes. -->
	<a {href} {target} {rel} class="btn {variant}" class:disabled aria-disabled={disabled} {onclick}>
		{@render children()}
	</a>
{:else}
	<button {type} {disabled} class="btn {variant}" {onclick}>
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
		maradhat a fényes --violet). */
		background: color-mix(in srgb, var(--violet) 80%, var(--cabinet));
		color: var(--marquee);
		border-color: var(--magenta);
	}

	.primary:hover:not(:disabled):not(.disabled) {
		/* Ugyanez a hover-állapotra: a natúr --magenta csak 2.9:1-et ad. */
		background: color-mix(in srgb, var(--magenta) 70%, var(--cabinet));
		box-shadow: 0 0 12px color-mix(in srgb, var(--magenta) 60%, transparent);
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
</style>
