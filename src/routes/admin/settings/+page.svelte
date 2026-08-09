<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Input from '$lib/components/Input.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedDefaultThemeId = $state(
		untrack(() => data.designThemes.find((t) => t.is_default)?.id ?? data.designThemes[0]?.id ?? '')
	);

	const handleSetDefaultTheme: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Globális alapértelmezett design téma frissítve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült frissíteni a témát.');
			}
			await update();
		};
	};

	// Csak prezentációs "cukorka" ismert kulcsokhoz (barátságosabb címke +
	// mértékegység) — ha egy jövőbeli app_settings sor nincs itt felsorolva,
	// attól még megjelenik a listában, csak a nyers kulcsnevét mutatja.
	const SETTING_META: Record<string, { label: string; unit?: string; description?: string }> = {
		question_reuse_cooldown_months: {
			label: 'Kérdés-újrafelhasználási türelmi idő',
			unit: 'hónap',
			description: 'Ennyi hónapig nem húzható újra ugyanaz a kérdés a "Random húzás" funkcióval.'
		}
	};

	type ValueType = 'number' | 'boolean' | 'string' | 'json';

	function valueType(value: unknown): ValueType {
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'boolean';
		if (typeof value === 'string') return 'string';
		return 'json';
	}

	const handleSave: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Beállítás mentve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a mentés.');
			}
			await update();
		};
	};
</script>

<svelte:head>
	<title>Beállítások — Kezelőfelület</title>
</svelte:head>

<h1>Globális beállítások</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<section class="setting-row">
	<div class="setting-info">
		<span class="setting-label">Globális alapértelmezett design téma</span>
		<p class="setting-description">
			Ez a köntös érvényes minden olyan kvízestén, amihez a host nem választott külön design témát (<a
				href={resolve('/admin/design-themes')}>Vizuális témák</a
			>). A választás azonnal, oldal-újratöltés nélkül alkalmazódik minden érintett nyitott
			felületen.
		</p>
	</div>
	{#if data.designThemes.length === 0}
		<p class="empty">Még nincs felvett design téma.</p>
	{:else}
		<form
			method="POST"
			action="?/set_default_theme"
			use:enhance={handleSetDefaultTheme}
			class="setting-form"
		>
			<Select name="design_theme_id" bind:value={selectedDefaultThemeId}>
				{#each data.designThemes as theme (theme.id)}
					<option value={theme.id}>{theme.title}{theme.is_default ? ' (jelenlegi)' : ''}</option>
				{/each}
			</Select>
			<Button type="submit">Beállítás alapértelmezettként</Button>
		</form>
	{/if}
</section>

<div class="settings-list">
	{#each data.settings as setting (setting.key)}
		{@const meta = SETTING_META[setting.key]}
		{@const type = valueType(setting.value)}
		<div class="setting-row">
			<div class="setting-info">
				<span class="setting-label">{meta?.label ?? setting.key}</span>
				<code class="setting-key">{setting.key}</code>
				{#if meta?.description}
					<p class="setting-description">{meta.description}</p>
				{/if}
			</div>
			<form method="POST" action="?/update" use:enhance={handleSave} class="setting-form">
				<input type="hidden" name="key" value={setting.key} />
				<input type="hidden" name="value_type" value={type} />

				{#if type === 'number'}
					<div class="value-input">
						<Input type="number" name="value" value={String(setting.value)} required />
						{#if meta?.unit}<span class="unit">{meta.unit}</span>{/if}
					</div>
				{:else if type === 'boolean'}
					<Checkbox
						name="value"
						value="true"
						checked={Boolean(setting.value)}
						label="Bekapcsolva"
					/>
				{:else if type === 'string'}
					<Input type="text" name="value" value={String(setting.value)} />
				{:else}
					<Textarea
						name="value"
						value={JSON.stringify(setting.value, null, 2)}
						monospace
						rows={4}
					/>
				{/if}

				<Button type="submit">Mentés</Button>
			</form>
		</div>
	{:else}
		<p class="empty">Nincs beállítás az app_settings táblában.</p>
	{/each}
</div>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.setting-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: space-between;
		align-items: flex-start;
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 28rem;
	}

	.setting-label {
		font-weight: 600;
		color: var(--marquee);
	}

	.setting-key {
		font-family: var(--font-led);
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	.setting-description {
		color: var(--marquee-dim);
		font-size: 0.85rem;
		margin: 0;
	}

	.setting-form {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.value-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.unit {
		color: var(--marquee-dim);
		font-size: 0.9rem;
	}

	.error {
		color: var(--danger);
	}

	.empty {
		color: var(--marquee-dim);
	}
</style>
