<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		name,
		value = $bindable(''),
		required = false,
		children,
		onchange
	}: {
		label?: string;
		name?: string;
		value?: string;
		required?: boolean;
		children: Snippet;
		onchange?: (event: Event) => void;
	} = $props();
</script>

<label class="field">
	{#if label}<span class="field-label">{label}</span>{/if}
	<select {name} bind:value {required} {onchange}>
		{@render children()}
	</select>
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: left;
	}

	.field-label {
		font-family: var(--font-body);
		font-size: 0.875rem;
		color: var(--marquee-dim);
	}

	select {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 2px solid var(--marquee-dim);
		background: var(--cabinet-2);
		color: var(--marquee);
		min-height: 44px;
		/* Fázis O5 — lásd Input.svelte jegyzete. */
		box-sizing: border-box;
	}

	select:focus-visible {
		outline: none;
		border-color: var(--cyan);
	}
</style>
