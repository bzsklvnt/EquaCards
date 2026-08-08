<script lang="ts">
	let {
		text,
		selected = false,
		disabled = false,
		onclick
	}: {
		text: string;
		selected?: boolean;
		disabled?: boolean;
		onclick?: () => void;
	} = $props();
</script>

<button type="button" class="choice" class:selected {disabled} {onclick}>
	{text}
</button>

<style>
	.choice {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.875rem;
		border: 2px solid var(--marquee-dim);
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		cursor: pointer;
		min-height: 44px;
		text-align: left;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.choice:hover:not(:disabled) {
		border-color: var(--cyan);
	}

	.choice:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.choice.selected {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 20%, var(--cabinet-2));
	}

	.choice:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
