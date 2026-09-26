<script lang="ts">
	import { refreshPage } from '$lib/admin/refresh';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import SaveStatus from '$lib/components/admin/SaveStatus.svelte';
	import ChoiceButton from '$lib/components/ChoiceButton.svelte';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import { createAutosave } from '$lib/admin/autosave.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { resolveTokens, tokensToCssText } from '$lib/theme/tokens';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Vizuális témák — lista · élő előnézet (kivetítő + telefon) · színek.
	// docs/features/admin-workspace.md, docs/features/design-themes.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'design-themes');

	const COLORS: [string, string][] = [
		['--cabinet', 'Háttér'],
		['--cabinet-2', 'Felület (kártyák)'],
		['--cabinet-3', 'Másodlagos felület'],
		['--marquee', 'Szöveg'],
		['--marquee-dim', 'Halvány szöveg'],
		['--cyan', 'Kiemelés'],
		['--power', 'Helyes / siker'],
		['--danger', 'Hiba / lejárt idő'],
		['--coin', 'Figyelmeztetés'],
		['--magenta', 'Joker']
	];

	let search = $state('');
	const visible = $derived(
		data.designThemes.filter((t) => t.title.toLowerCase().includes(search.trim().toLowerCase()))
	);
	const selection = createSelection('id', () => visible[0]?.id ?? null);
	const selected = $derived(data.designThemes.find((t) => t.id === selection.id) ?? null);

	let title = $state('');
	let isDefault = $state(false);
	let tokens = $state<Record<string, string>>({});
	let jsonText = $state('');
	let jsonError = $state('');
	let form = $state<HTMLFormElement>();

	const autosave = createAutosave({
		snapshot: () => JSON.stringify({ title, isDefault, tokens }),
		submit: () => {
			if (title.trim() && !jsonError) form?.requestSubmit();
		}
	});

	let loadedId: string | null = null;
	$effect(() => {
		const t = selected;
		if (!t || t.id === loadedId) return;
		loadedId = t.id;
		title = t.title;
		isDefault = t.is_default;
		tokens = { ...t.design_tokens };
		jsonText = JSON.stringify(t.design_tokens, null, 2);
		jsonError = '';
		autosave.reset();
	});

	function setColor(key: string, value: string) {
		tokens = { ...tokens, [key]: value };
		jsonText = JSON.stringify(tokens, null, 2);
	}

	function onJson(value: string) {
		jsonText = value;
		try {
			const parsed = JSON.parse(value) as unknown;
			if (
				typeof parsed !== 'object' ||
				parsed === null ||
				Array.isArray(parsed) ||
				Object.values(parsed).some((v) => typeof v !== 'string')
			) {
				jsonError = 'Sima { "kulcs": "érték" } objektum kell.';
				return;
			}
			jsonError = '';
			tokens = parsed as Record<string, string>;
		} catch {
			jsonError = 'Érvénytelen JSON.';
		}
	}

	const previewCss = $derived(tokensToCssText(resolveTokens(tokens)));
	const hex = (value: string | undefined) =>
		value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';

	const swatch = (t: PageData['designThemes'][number]) =>
		['--cabinet', '--cabinet-2', '--cyan', '--marquee'].map((k) => t.design_tokens[k] ?? '#ccc');

	// --- Új téma, törlés --------------------------------------------------------
	let newTitle = $state('');
	let newInput = $state<HTMLInputElement>();
	let busy = $state(false);

	const create: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				newTitle = '';
				await refreshPage(update);
				if (result.data?.createdId) selection.set(String(result.data.createdId));
				toast.success('Téma létrehozva a Letisztult alapból — színezd át!');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült.');
			}
		};
	};

	const remove: SubmitFunction = ({ cancel }) => {
		if (!confirm(`Törlöd a(z) „${selected?.title}” vizuális témát?`)) {
			cancel();
			return;
		}
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				loadedId = null;
				selection.set(null);
				toast.success('Téma törölve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült.');
			}
			await refreshPage(update);
		};
	};

	onMount(() => {
		if (page.url.searchParams.get('new') === '1') newInput?.focus();
	});

	function onKeydown(e: KeyboardEvent) {
		if (!plainKey(e)) return;
		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			newInput?.focus();
		}
	}

	registerPageShortcuts(() => [
		{ title: 'Vizuális témák', items: [{ label: 'Új téma', keys: ['N'] }] }
	]);
</script>

<svelte:head>
	<title>Vizuális témák — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<Workspace
	label="Vizuális témák"
	sideWidth="22rem"
	keys={[
		['↑ ↓', 'témák'],
		['N', 'új téma'],
		['/', 'szűrés']
	]}
>
	{#snippet rail()}
		<div class="rail-wrap" data-tour="dt-list">
			<RailList
				label="Vizuális témák"
				groups={[{ items: visible }]}
				getId={(t) => t.id}
				selectedId={selection.id}
				onselect={(t) => {
					autosave.flush();
					selection.set(t.id);
				}}
				bind:search
				placeholder="Szűrés…"
			>
				{#snippet item(t)}
					<span class="sw" aria-hidden="true">
						{#each swatch(t) as color, i (i)}<i style="background: {color}"></i>{/each}
					</span>
					<span class="ws-item-text"><strong>{t.title}</strong></span>
					{#if t.is_default}<span class="ws-pill ok">alap</span>{/if}
				{/snippet}
				{#snippet footer()}
					<form method="POST" action="?/create" class="new" data-tour="dt-new" use:enhance={create}>
						<input
							bind:this={newInput}
							name="title"
							bind:value={newTitle}
							placeholder="Új téma neve (N)"
							aria-label="Új téma neve"
							required
						/>
						<button type="submit" class="ws-btn outline" disabled={busy || !newTitle.trim()}
							>+</button
						>
					</form>
				{/snippet}
			</RailList>
		</div>
	{/snippet}

	{#snippet main()}
		{#if selected}
			<div class="ws-crumb">
				Vizuális témák › <b>{selected.title}</b>
				<SaveStatus state={autosave.state} error={autosave.error} />
			</div>
			<form
				bind:this={form}
				method="POST"
				action="?/update"
				class="head-form"
				use:enhance={autosave.enhance}
			>
				<input type="hidden" name="id" value={selected.id} />
				<input type="hidden" name="design_tokens" value={JSON.stringify(tokens)} />
				<label class="ws-field title" data-tour="dte-title"
					><span>Név</span><input name="title" bind:value={title} required maxlength="60" /></label
				>
				<label class="ws-toggle" data-tour="dte-default">
					<span>Alapértelmezett téma</span>
					<input type="checkbox" name="is_default" value="true" bind:checked={isDefault} />
				</label>
			</form>
			<p class="ws-note" data-tour="dt-hint">
				Ez a téma a játékfelületeken (kivetítő, host, csapatok) érvényes; a kezelői felület mindig a
				Letisztult megjelenést használja. Estéként az Esemény fülön választható.
			</p>

			<div class="previews" style={previewCss}>
				<div class="tv">
					<div class="tv-top"><span>Földrajz — 3/8</span><span>12 csapat</span></div>
					<p class="tv-prompt">Melyik ország fővárosa Canberra?</p>
					<div class="tv-grid">
						{#each ['Ausztrália', 'Új-Zéland', 'Ausztria', 'Kanada'] as text, i (text)}
							<ChoiceButton {text} suit={i} display />
						{/each}
					</div>
					<div class="tv-timer"><TimerRing secondsLeft={18} duration={30} size={84} /></div>
				</div>
				<div class="phone">
					<p class="phone-title">Őszi nyitó kvízest</p>
					<p class="phone-prompt">Melyik ország fővárosa Canberra?</p>
					{#each ['Ausztrália', 'Új-Zéland'] as text, i (text)}
						<ChoiceButton {text} suit={i} selected={i === 0} />
					{/each}
					<p class="phone-ok">Eltaláltad! +950 pont</p>
				</div>
			</div>
		{:else}
			<div class="ws-empty">
				<h2>Vizuális témák</h2>
				<p>Hozz létre egy témát (N).</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		{#if selected}
			<p class="ws-cap">Színek</p>
			<div class="colors" data-tour="dte-tokens">
				{#each COLORS as [key, label] (key)}
					<label class="color">
						<input
							type="color"
							value={hex(tokens[key])}
							oninput={(e) => setColor(key, e.currentTarget.value)}
						/>
						<span>{label}</span>
						<code>{tokens[key] ?? '—'}</code>
					</label>
				{/each}
			</div>
			<details>
				<summary>Haladó: összes token (JSON)</summary>
				<textarea
					class="json"
					rows="14"
					spellcheck="false"
					value={jsonText}
					oninput={(e) => onJson(e.currentTarget.value)}></textarea>
				{#if jsonError}<p class="err">{jsonError}</p>{/if}
			</details>
			<form method="POST" action="?/delete" class="danger" use:enhance={remove}>
				<input type="hidden" name="id" value={selected.id} />
				<button type="submit" class="ws-btn danger" disabled={busy || selected.is_default}
					>{selected.is_default ? 'Az alapértelmezett nem törölhető' : 'Téma törlése'}</button
				>
			</form>
		{/if}
	{/snippet}
</Workspace>

<style>
	.rail-wrap {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.sw {
		display: grid;
		grid-template-columns: repeat(2, 0.8rem);
		gap: 2px;
		flex-shrink: 0;
	}

	.sw i {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		border: 1px solid rgb(0 0 0 / 10%);
	}

	.new {
		display: flex;
		gap: 0.4rem;
		width: 100%;
	}

	.new input {
		flex: 1;
		min-width: 0;
		height: 2.4rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		padding: 0 0.6rem;
		font: inherit;
	}

	.head-form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
	}

	.head-form .title {
		flex: 1;
		min-width: 14rem;
	}

	.previews {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 15rem;
		gap: 1rem;
		align-items: start;
	}

	.tv,
	.phone {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem;
		border-radius: 1rem;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		border: 6px solid #2e2c27;
	}

	.phone {
		border-radius: 1.6rem;
	}

	.tv-top {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.tv-prompt,
	.phone-prompt {
		margin: 0.3rem 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		text-align: center;
	}

	.phone-prompt {
		font-size: 1rem;
	}

	.phone-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: var(--cyan);
		text-align: center;
	}

	.phone-ok {
		margin: 0;
		color: var(--power);
		font-weight: 700;
		text-align: center;
	}

	.tv-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.tv-timer {
		display: flex;
		justify-content: center;
	}

	.colors {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.color {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.color input {
		width: 2.2rem;
		height: 1.8rem;
		padding: 0;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.35rem;
		background: none;
	}

	.color span {
		flex: 1;
	}

	.color code {
		font-size: 0.72rem;
		color: var(--marquee-dim);
	}

	details summary {
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.json {
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.5rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		padding: 0.5rem;
		font-family: ui-monospace, monospace;
		font-size: 0.78rem;
	}

	.err {
		margin: 0.3rem 0 0;
		color: var(--danger);
		font-size: 0.85rem;
	}

	.danger {
		margin-top: auto;
	}

	@media (max-width: 1300px) {
		.previews {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
