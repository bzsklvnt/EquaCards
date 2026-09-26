<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { Json } from '$lib/types/database.types';
	import { createAutosave } from '$lib/admin/autosave.svelte';
	import SaveStatus from './SaveStatus.svelte';

	// Egy app_settings sor szerkesztése automatikus mentéssel (a Beállítások
	// oldal ?/update action-jére) — docs/features/admin-workspace.md.
	let {
		settingKey,
		value,
		label,
		description,
		unit,
		presets = []
	}: {
		settingKey: string;
		value: Json;
		label: string;
		description?: string;
		unit?: string;
		presets?: number[];
	} = $props();

	type ValueType = 'number' | 'boolean' | 'string' | 'json';
	const type: ValueType = untrack(() =>
		typeof value === 'number'
			? 'number'
			: typeof value === 'boolean'
				? 'boolean'
				: typeof value === 'string'
					? 'string'
					: 'json'
	);

	let text = $state(
		untrack(() =>
			type === 'json' ? JSON.stringify(value, null, 2) : type === 'boolean' ? '' : String(value)
		)
	);
	let checked = $state(untrack(() => value === true));
	let form = $state<HTMLFormElement>();

	const autosave = createAutosave({
		snapshot: () => `${text}|${checked}`,
		submit: () => form?.requestSubmit(),
		delay: type === 'number' || type === 'boolean' ? 500 : 900
	});
</script>

<form
	bind:this={form}
	method="POST"
	action="?/update"
	class="setting"
	data-setting={settingKey}
	use:enhance={autosave.enhance}
>
	<input type="hidden" name="key" value={settingKey} />
	<input type="hidden" name="value_type" value={type} />
	<div class="info">
		<div class="label-row">
			<span class="label">{label}</span>
			<SaveStatus state={autosave.state} error={autosave.error} />
		</div>
		{#if description}<p class="desc">{description}</p>{/if}
	</div>
	<div class="control">
		{#if type === 'number'}
			{#if presets.length > 0}
				<div class="ws-chips" role="group" aria-label={label}>
					{#each presets as preset (preset)}
						<button
							type="button"
							class="ws-chip"
							aria-pressed={Number(text) === preset}
							onclick={() => (text = String(preset))}>{preset}</button
						>
					{/each}
				</div>
			{/if}
			<label class="num">
				<input name="value" type="number" bind:value={text} required aria-label={label} />
				{#if unit}<span>{unit}</span>{/if}
			</label>
		{:else if type === 'boolean'}
			<label class="ws-toggle">
				<span>Bekapcsolva</span>
				<input type="checkbox" name="value" value="true" bind:checked />
			</label>
		{:else if type === 'string'}
			<input class="text" name="value" type="text" bind:value={text} aria-label={label} />
		{:else}
			<textarea class="json" name="value" rows="4" bind:value={text} aria-label={label}></textarea>
		{/if}
	</div>
</form>

<style>
	.setting {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 22rem);
		gap: 0.6rem 1.5rem;
		align-items: center;
		padding: 1rem 1.2rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 1rem;
		background: var(--cabinet-2);
	}

	.label-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
	}

	.label {
		font-weight: 700;
	}

	.desc {
		margin: 0.3rem 0 0;
		font-size: 0.86rem;
		line-height: 1.45;
		color: var(--marquee-dim);
	}

	.control {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.num {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--marquee-dim);
	}

	.num input {
		width: 5.5rem;
	}

	input.text,
	.num input,
	.json {
		min-height: 2.4rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		padding: 0.4rem 0.6rem;
		font: inherit;
		color: var(--marquee);
		background: var(--cabinet-2);
	}

	input.text,
	.json {
		width: 100%;
	}

	.json {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}

	input:focus-visible,
	.json:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	@media (max-width: 900px) {
		.setting {
			grid-template-columns: minmax(0, 1fr);
		}

		.control {
			justify-content: flex-start;
		}
	}
</style>
