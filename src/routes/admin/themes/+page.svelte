<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import SaveStatus from '$lib/components/admin/SaveStatus.svelte';
	import { createAutosave } from '$lib/admin/autosave.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { TYPE_SHORT } from '$lib/builder/model';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Témák — lista · részlet (név automatikus mentéssel, a téma kérdései) ·
	// statisztika. docs/features/admin-workspace.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'themes');

	let search = $state('');
	const visible = $derived(
		data.themes.filter((t) => t.title.toLowerCase().includes(search.trim().toLowerCase()))
	);
	const selection = createSelection('id', () => visible[0]?.id ?? null);
	const selected = $derived(data.themes.find((t) => t.id === selection.id) ?? null);

	let title = $state('');
	let form = $state<HTMLFormElement>();
	const autosave = createAutosave({ snapshot: () => title, submit: () => form?.requestSubmit() });
	let loadedId: string | null = null;
	$effect(() => {
		const t = selected;
		if (!t || t.id === loadedId) return;
		loadedId = t.id;
		title = t.title;
		autosave.reset();
	});

	let newTitle = $state('');
	let busy = $state(false);
	let newInput = $state<HTMLInputElement>();

	const create: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				newTitle = '';
				await update();
				if (result.data?.createdId) selection.set(String(result.data.createdId));
				toast.success('Téma létrehozva.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült.');
			}
		};
	};

	const remove: SubmitFunction = ({ cancel }) => {
		const count = selected?.count ?? 0;
		if (
			!confirm(
				`Törlöd a(z) „${selected?.title}” témát?${count ? ` ${count} kérdés téma nélkül marad.` : ''}`
			)
		) {
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
			await update();
		};
	};

	function onKeydown(e: KeyboardEvent) {
		if (!plainKey(e)) return;
		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			newInput?.focus();
		}
	}

	registerPageShortcuts(() => [{ title: 'Témák', items: [{ label: 'Új téma', keys: ['N'] }] }]);
</script>

<svelte:head>
	<title>Témák — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<Workspace
	label="Témák"
	keys={[
		['↑ ↓', 'témák'],
		['Enter', 'átnevezés'],
		['N', 'új téma'],
		['/', 'szűrés']
	]}
>
	{#snippet rail()}
		<div class="rail-wrap" data-tour="theme-list">
			<RailList
				label="Témák"
				groups={[{ items: visible }]}
				getId={(t) => t.id}
				selectedId={selection.id}
				onselect={(t) => {
					autosave.flush();
					selection.set(t.id);
				}}
				onopen={() => document.getElementById('theme-title')?.focus()}
				bind:search
				placeholder="Szűrés…"
				empty="Még nincs téma."
			>
				{#snippet item(t)}
					<span class="ws-item-text">
						<strong>{t.title}</strong>
						<small>{t.count} kérdés · {t.fresh} még nem játszott</small>
					</span>
				{/snippet}
				{#snippet footer()}
					<form
						method="POST"
						action="?/create"
						class="new"
						data-tour="theme-create"
						use:enhance={create}
					>
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
				Témák › <b>{selected.title}</b>
				<SaveStatus state={autosave.state} error={autosave.error} />
			</div>
			<form bind:this={form} method="POST" action="?/update" use:enhance={autosave.enhance}>
				<input type="hidden" name="id" value={selected.id} />
				<label class="ws-field title-field">
					<span>A téma neve</span>
					<input id="theme-title" name="title" bind:value={title} required maxlength="80" />
				</label>
			</form>
			<div class="ws-card">
				<div class="ws-card-head">
					<h2>A téma kérdései</h2>
					<a href={`${resolve('/admin/questions')}?theme_id=${selected.id}`}
						>Megnyitás a kérdésbankban →</a
					>
				</div>
				{#each selected.questions as q (q.id)}
					<a class="q-row" href={`${resolve('/admin/questions')}?id=${q.id}`}>
						<span>{q.prompt}</span><small>{TYPE_SHORT[q.type_code] ?? q.type_code}</small>
					</a>
				{:else}
					<p class="ws-note">Még nincs kérdés ebben a témában.</p>
				{/each}
				{#if selected.count > selected.questions.length}
					<p class="ws-note">…és még {selected.count - selected.questions.length} kérdés.</p>
				{/if}
			</div>
		{:else}
			<div class="ws-empty">
				<h2>Témák</h2>
				<p>A kérdések kategóriái — a kérdésbank szűréséhez és a random húzáshoz kellenek.</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		{#if selected}
			<p class="ws-cap">Statisztika</p>
			<div class="ws-tiles">
				<div class="ws-tile">Kérdés <strong>{selected.count}</strong></div>
				<div class="ws-tile">Még nem játszott <strong>{selected.fresh}</strong></div>
			</div>
			<p class="ws-note">
				A random húzás csak a még nem játszott (vagy a pihentetési időn túli) kérdésekből választ.
			</p>
			<form method="POST" action="?/delete" class="danger" use:enhance={remove}>
				<input type="hidden" name="id" value={selected.id} />
				<button type="submit" class="ws-btn danger" disabled={busy}>Téma törlése</button>
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

	.title-field input {
		font-family: var(--font-display);
		font-size: 1.5rem;
	}

	.q-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.45rem 0.2rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
		color: var(--marquee);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.q-row:hover span {
		color: var(--cyan);
	}

	.q-row small {
		flex-shrink: 0;
		color: var(--marquee-dim);
	}

	.danger {
		margin-top: auto;
	}
</style>
