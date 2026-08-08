<script lang="ts">
	let {
		label,
		name,
		checked = $bindable(false),
		value,
		onchange
	}: {
		label: string;
		name?: string;
		checked?: boolean;
		value?: string;
		onchange?: (event: Event) => void;
	} = $props();
</script>

<label class="checkbox-field">
	<input type="checkbox" {name} bind:checked {value} {onchange} />
	<span>{label}</span>
</label>

<style>
	.checkbox-field {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-body);
		color: var(--marquee);
		cursor: pointer;
	}

	input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--cyan);
	}

	input:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}
</style>
