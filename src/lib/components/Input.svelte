<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		name,
		type = 'text',
		value = $bindable(''),
		placeholder,
		required = false,
		maxlength,
		minlength,
		min,
		max,
		step,
		autocomplete,
		inputmode,
		pattern
	}: {
		label?: string;
		name?: string;
		type?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		maxlength?: number;
		minlength?: number;
		min?: string | number;
		max?: string | number;
		step?: string | number;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		inputmode?: HTMLInputAttributes['inputmode'];
		pattern?: string;
	} = $props();
</script>

<label class="field">
	{#if label}<span class="field-label">{label}</span>{/if}
	<input
		{name}
		{type}
		bind:value
		{placeholder}
		{required}
		{maxlength}
		{minlength}
		{min}
		{max}
		{step}
		{autocomplete}
		{inputmode}
		{pattern}
	/>
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

	input {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 2px solid var(--marquee-dim);
		background: var(--cabinet-2);
		color: var(--marquee);
		min-height: 44px;
	}

	input:focus-visible {
		outline: none;
		border-color: var(--cyan);
	}
</style>
