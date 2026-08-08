<script lang="ts">
	let {
		label,
		name,
		value = $bindable(''),
		placeholder,
		required = false,
		rows = 3,
		spellcheck,
		monospace = false
	}: {
		label?: string;
		name?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		rows?: number;
		spellcheck?: boolean;
		monospace?: boolean;
	} = $props();
</script>

<label class="field">
	{#if label}<span class="field-label">{label}</span>{/if}
	<textarea {name} bind:value {placeholder} {required} {rows} {spellcheck} class:monospace
	></textarea>
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

	textarea {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 2px solid var(--marquee-dim);
		background: var(--cabinet-2);
		color: var(--marquee);
		resize: vertical;
	}

	textarea:focus-visible {
		outline: none;
		border-color: var(--cyan);
	}

	textarea.monospace {
		font-family: var(--font-led), monospace;
		font-size: 0.8125rem;
	}
</style>
