<script lang="ts">
	let {
		name,
		own = false
	}: {
		name: string;
		own?: boolean;
	} = $props();
</script>

<span class="chip" class:own>{name}</span>

<style>
	.chip {
		display: inline-block;
		font-family: var(--font-body);
		font-size: 0.9rem;
		background: var(--cabinet-2);
		border: 1px solid var(--violet);
		border-radius: 999px;
		padding: 0.25rem 0.875rem;
		color: var(--marquee);
	}

	.chip.own {
		border-color: var(--cyan);
		color: var(--cyan);
		font-weight: bold;
		box-shadow: 0 0 8px color-mix(in srgb, var(--cyan) 40%, transparent);
	}
</style>
