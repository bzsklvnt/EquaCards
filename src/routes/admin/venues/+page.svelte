<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import SaveStatus from '$lib/components/admin/SaveStatus.svelte';
	import { createAutosave } from '$lib/admin/autosave.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { formatEventDate } from '$lib/datetime';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Helyszínek — lista · részlet (automatikus mentés) · esték ezen a helyen.
	// docs/features/admin-workspace.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'venues');

	let search = $state('');
	const visible = $derived(
		data.venues.filter((v) =>
			`${v.name} ${v.city ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
		)
	);
	const selection = createSelection('id', () => visible[0]?.id ?? null);
	const selected = $derived(data.venues.find((v) => v.id === selection.id) ?? null);

	let fields = $state({ name: '', address: '', city: '', maps_url: '' });
	let form = $state<HTMLFormElement>();
	const autosave = createAutosave({
		snapshot: () => JSON.stringify(fields),
		submit: () => form?.requestSubmit()
	});

	let loadedId: string | null = null;
	$effect(() => {
		const v = selected;
		if (!v || v.id === loadedId) return;
		loadedId = v.id;
		fields = {
			name: v.name,
			address: v.address ?? '',
			city: v.city ?? '',
			maps_url: v.maps_url ?? ''
		};
		autosave.reset();
	});

	const nextGame = $derived(
		selected?.games.find(
			(g) => g.status === 'lobby' && g.scheduled_at && g.scheduled_at > new Date().toISOString()
		) ?? null
	);

	// --- Új helyszín és törlés -------------------------------------------------
	let createOpen = $state(false);
	let createDialog = $state<HTMLDialogElement>();
	let newName = $state('');
	let busy = $state(false);

	$effect(() => {
		if (!createDialog) return;
		if (createOpen && !createDialog.open) createDialog.showModal();
		if (!createOpen && createDialog.open) createDialog.close();
	});

	const create: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				createOpen = false;
				newName = '';
				await update();
				if (result.data?.createdId) selection.set(String(result.data.createdId));
				toast.success('Helyszín felvéve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült.');
			}
		};
	};

	const remove: SubmitFunction = ({ cancel }) => {
		if (
			!confirm(
				`Törlöd a(z) „${selected?.name}” helyszínt? A hozzá tartozó esték megmaradnak, csak a helyszínük lesz üres.`
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
				toast.success('Helyszín törölve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült.');
			}
			await update();
		};
	};

	onMount(() => {
		if (page.url.searchParams.get('new') === '1') createOpen = true;
	});

	function onKeydown(e: KeyboardEvent) {
		if (!plainKey(e)) return;
		if (e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			createOpen = true;
		}
	}

	registerPageShortcuts(() => [
		{ title: 'Helyszínek', items: [{ label: 'Új helyszín', keys: ['N'] }] }
	]);
</script>

<svelte:head>
	<title>Helyszínek — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<Workspace
	label="Helyszínek"
	keys={[
		['↑ ↓', 'helyszínek'],
		['Enter', 'szerkesztés'],
		['N', 'új'],
		['/', 'szűrés']
	]}
>
	{#snippet rail()}
		<div class="rail-wrap" data-tour="venues-list">
			<RailList
				label="Helyszínek"
				groups={[{ items: visible }]}
				getId={(v) => v.id}
				selectedId={selection.id}
				onselect={(v) => {
					// a függő mentés még a régi elem űrlapjával megy el
					autosave.flush();
					selection.set(v.id);
				}}
				onopen={() => document.getElementById('venue-name')?.focus()}
				bind:search
				placeholder="Szűrés…"
				empty="Még nincs helyszín — vedd fel az elsőt (N)."
			>
				{#snippet item(v)}
					<span class="ws-item-text">
						<strong>{v.name}</strong>
						<small>{v.city ?? 'nincs város'} · {v.games.length} este</small>
					</span>
				{/snippet}
				{#snippet footer()}
					<button
						type="button"
						class="ws-btn outline"
						data-tour="venues-create"
						onclick={() => (createOpen = true)}>+ Helyszín <kbd class="ws-kbd">N</kbd></button
					>
				{/snippet}
			</RailList>
		</div>
	{/snippet}

	{#snippet main()}
		{#if selected}
			<div class="ws-crumb">
				Helyszínek › <b>{selected.name}</b>
				<SaveStatus state={autosave.state} error={autosave.error} />
			</div>
			<h1 class="ws-h1">{fields.name || 'Névtelen helyszín'}</h1>
			<form
				bind:this={form}
				method="POST"
				action="?/update"
				class="ws-card"
				use:enhance={autosave.enhance}
			>
				<input type="hidden" name="id" value={selected.id} />
				<div class="ws-grid2">
					<label class="ws-field"
						><span>Név</span><input
							id="venue-name"
							name="name"
							bind:value={fields.name}
							required
							maxlength="80"
						/></label
					>
					<label class="ws-field"
						><span>Város</span><input name="city" bind:value={fields.city} maxlength="80" /></label
					>
				</div>
				<label class="ws-field"
					><span>Cím</span><input
						name="address"
						bind:value={fields.address}
						maxlength="160"
					/></label
				>
				<label class="ws-field"
					><span>Térkép-link (nem kötelező)</span><input
						name="maps_url"
						type="url"
						placeholder="https://…"
						bind:value={fields.maps_url}
					/></label
				>
			</form>
			<div class="ws-card">
				<h2>Így látszik a nyilvános oldalon</h2>
				<div class="preview">
					<div>
						<b>{nextGame?.title ?? 'Következő kvízest'}</b>
						<span
							>{nextGame?.scheduled_at ? formatEventDate(nextGame.scheduled_at) : 'időpont'} · {fields.name}{fields.city
								? `, ${fields.city}`
								: ''}</span
						>
						{#if fields.address}<span>{fields.address}{fields.maps_url ? ' · térkép ↗' : ''}</span
							>{/if}
					</div>
					<span class="ws-btn primary">Jelentkezem</span>
				</div>
			</div>
		{:else}
			<div class="ws-empty">
				<h2>Helyszínek</h2>
				<p>A kvízesték helyszínei — a nyilvános oldalon a név, a cím és a térkép-link látszik.</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		{#if selected}
			<p class="ws-cap">Esték ezen a helyszínen</p>
			{#each selected.games as g (g.id)}
				<a class="ws-action" href={`${resolve('/admin/games')}?id=${g.id}`}
					><span>{g.title}</span><span class="ws-pill" class:warn={g.status === 'lobby'}
						>{g.scheduled_at ? formatEventDate(g.scheduled_at).split(',')[0] : g.status}</span
					></a
				>
			{:else}
				<p class="ws-note">Még nincs este ezen a helyszínen.</p>
			{/each}
			<form method="POST" action="?/delete" class="danger" use:enhance={remove}>
				<input type="hidden" name="id" value={selected.id} />
				<button type="submit" class="ws-btn danger" disabled={busy}>Helyszín törlése</button>
			</form>
		{/if}
	{/snippet}
</Workspace>

<dialog
	bind:this={createDialog}
	class="small-dialog"
	aria-labelledby="venue-create-title"
	onclose={() => (createOpen = false)}
>
	<form method="POST" action="?/create" use:enhance={create}>
		<h2 id="venue-create-title">Új helyszín</h2>
		<label class="ws-field"
			><span>Név</span><input name="name" bind:value={newName} required maxlength="80" /></label
		>
		<p class="ws-note">A címet, a várost és a térkép-linket utána a részleteknél adhatod meg.</p>
		<div class="dialog-actions">
			<button type="button" class="ws-btn" onclick={() => (createOpen = false)}>Mégse</button>
			<button type="submit" class="ws-btn primary" disabled={busy || !newName.trim()}
				>Felvétel</button
			>
		</div>
	</form>
</dialog>

<style>
	.rail-wrap {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.preview {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.8rem;
	}

	.preview div {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.preview b {
		font-family: var(--font-display);
		font-size: 1.15rem;
	}

	.preview span {
		font-size: 0.85rem;
		color: var(--marquee-dim);
	}

	.danger {
		margin-top: auto;
	}

	.small-dialog {
		width: min(28rem, calc(100vw - 2rem));
		padding: 1.3rem 1.4rem;
		border: 0;
		border-radius: 1rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: 0 30px 60px rgb(0 0 0 / 25%);
	}

	.small-dialog::backdrop {
		background: rgb(28 27 24 / 40%);
	}

	.small-dialog form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.small-dialog h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
