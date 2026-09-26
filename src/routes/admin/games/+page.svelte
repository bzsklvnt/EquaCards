<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import DeleteGameButton from '$lib/components/DeleteGameButton.svelte';
	import { withToast } from '$lib/toast-enhance';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { eventDateParts, formatEventDate } from '$lib/datetime';
	import type { ActionData, PageData } from './$types';

	// Kvízesték — lista · részlet · műveletek (docs/features/admin-workspace.md).
	let { data, form }: { data: PageData; form: ActionData } = $props();

	registerPageTour(() => 'games');

	type Game = PageData['games'][number];
	type Filter = 'all' | 'upcoming' | 'live' | 'finished' | 'practice';

	const isSuperAdmin = $derived(data.profile?.role_id === 1);
	let search = $state('');
	let filter = $state<Filter>('all');
	let creatingOpen = $state(false);
	let newTitle = $state('');
	let creating = $state(false);
	let creatingPractice = $state(false);
	let reopening = $state(false);
	let createDialog = $state<HTMLDialogElement>();

	const STATUS: Record<string, string> = {
		lobby: 'Váró',
		active: 'Élő',
		paused: 'Szünetel',
		finished: 'Lezárva'
	};

	const bucket = (g: Game): Exclude<Filter, 'all'> =>
		g.is_practice
			? 'practice'
			: g.status === 'active' || g.status === 'paused'
				? 'live'
				: g.status === 'finished'
					? 'finished'
					: 'upcoming';

	const visible = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		return data.games.filter(
			(g) =>
				(filter === 'all' || bucket(g) === filter) &&
				(!needle || g.title.toLowerCase().includes(needle))
		);
	});

	const groups = $derived([
		{ label: 'Élő most', items: visible.filter((g) => bucket(g) === 'live') },
		{
			label: 'Közelgő',
			items: visible
				.filter((g) => bucket(g) === 'upcoming')
				.sort((a, b) => (a.scheduled_at ?? '9').localeCompare(b.scheduled_at ?? '9'))
		},
		{ label: 'Lezárt', items: visible.filter((g) => bucket(g) === 'finished') },
		{ label: 'Próbaesték', items: visible.filter((g) => bucket(g) === 'practice') }
	]);

	const firstId = () => groups.find((g) => g.items.length > 0)?.items[0]?.id ?? null;
	const selection = createSelection('id', firstId);
	const selected = $derived(data.games.find((g) => g.id === selection.id) ?? null);

	const questionCount = (g: Game) => g.rounds.reduce((n, r) => n + r.questions, 0);

	type Todo = { ok: boolean; text: string; href?: string; link?: string };
	const todos = $derived.by((): Todo[] => {
		const g = selected;
		if (!g || g.is_practice || g.status === 'finished') return [];
		const eventHref = resolve('/admin/games/[id]/event', { id: g.id });
		const builderHref = resolve('/admin/games/[id]', { id: g.id });
		const empty = g.rounds.filter((r) => r.questions === 0);
		return [
			{
				ok: !!g.scheduled_at,
				text: g.scheduled_at ? 'Időpont megadva' : 'Nincs időpont',
				href: eventHref,
				link: 'Esemény'
			},
			{
				ok: !!g.venues?.name,
				text: g.venues?.name ? 'Helyszín megadva' : 'Nincs helyszín',
				href: eventHref,
				link: 'Esemény'
			},
			{
				ok: g.is_public,
				text: g.is_public
					? 'Nyilvános, a jelentkezés nyitva'
					: 'Nem nyilvános — a landing oldalon nem látszik',
				href: eventHref,
				link: 'Esemény'
			},
			{
				ok: g.rounds.length > 0 && empty.length === 0,
				text:
					g.rounds.length === 0
						? 'Még nincs kör'
						: empty.length > 0
							? `${empty.length} üres kör`
							: `${g.rounds.length} kör, ${questionCount(g)} kérdés`,
				href: builderHref,
				link: 'Összerakó'
			},
			...(g.waitlistTeams > 0
				? [
						{
							ok: false,
							text: `${g.waitlistTeams} csapat várólistán — emelhető a létszámkorlát`,
							href: eventHref,
							link: 'Esemény'
						}
					]
				: [])
		];
	});

	function openCreate() {
		creatingOpen = true;
	}

	$effect(() => {
		if (!createDialog) return;
		if (creatingOpen && !createDialog.open) createDialog.showModal();
		if (!creatingOpen && createDialog.open) createDialog.close();
	});

	onMount(() => {
		if (page.url.searchParams.get('new') === '1') openCreate();
	});

	function go(href: string) {
		void goto(href);
	}

	function onKeydown(e: KeyboardEvent) {
		if (!plainKey(e)) return;
		const g = selected;
		switch (e.key.toLowerCase()) {
			case 'n':
				e.preventDefault();
				openCreate();
				return;
		}
		if (!g) return;
		switch (e.key.toLowerCase()) {
			case 'e':
				e.preventDefault();
				go(resolve('/admin/games/[id]/event', { id: g.id }));
				break;
			case 'r':
				e.preventDefault();
				go(resolve('/admin/games/[id]/results', { id: g.id }));
				break;
			case 'l':
				e.preventDefault();
				go(resolve('/host/[game_id]', { game_id: g.id }));
				break;
			case 'v':
				e.preventDefault();
				window.open(resolve('/tv/[game_id]', { game_id: g.id }), '_blank', 'noopener');
				break;
		}
	}

	registerPageShortcuts(() => [
		{
			title: 'Kvízesték',
			items: [
				{ label: 'Kvízösszerakó', keys: ['Enter'] },
				{ label: 'Esemény és jelentkezések', keys: ['E'] },
				{ label: 'Eredmények', keys: ['R'] },
				{ label: 'Élő lebonyolítás', keys: ['L'] },
				{ label: 'Kivetítő új lapon', keys: ['V'] },
				{ label: 'Új kvízeste', keys: ['N'] }
			]
		}
	]);

	const FILTERS: [Filter, string][] = [
		['all', 'Mind'],
		['upcoming', 'Közelgő'],
		['live', 'Élő'],
		['finished', 'Lezárt'],
		['practice', 'Próba']
	];
</script>

<svelte:head>
	<title>Kvízesték — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<Workspace
	label="Kvízesték"
	keys={[
		['↑ ↓', 'esték'],
		['Enter', 'összerakó'],
		['E', 'esemény'],
		['R', 'eredmények'],
		['L', 'élő'],
		['N', 'új este']
	]}
>
	{#snippet rail()}
		<div class="rail-wrap" data-tour="games-list">
			<RailList
				label="Kvízesték"
				{groups}
				getId={(g) => g.id}
				selectedId={selection.id}
				onselect={(g) => selection.set(g.id)}
				onopen={(g) => go(resolve('/admin/games/[id]', { id: g.id }))}
				bind:search
				placeholder="Szűrés név szerint…"
				empty="Nincs kvízeste ezzel a szűréssel."
			>
				{#snippet header()}
					<div class="ws-chips" role="group" aria-label="Szűrő">
						{#each FILTERS as [value, label] (value)}
							<button
								type="button"
								class="ws-chip"
								aria-pressed={filter === value}
								onclick={() => (filter = value)}>{label}</button
							>
						{/each}
					</div>
				{/snippet}
				{#snippet item(g)}
					{#if g.scheduled_at}
						{@const d = eventDateParts(g.scheduled_at)}
						<span class="ws-date"><b>{d.day}</b><small>{d.month}</small></span>
					{:else}
						<span class="ws-date"><b>–</b><small>nincs</small></span>
					{/if}
					<span class="ws-item-text">
						<strong>{g.title}</strong>
						<small
							>{#if bucket(g) === 'finished'}{g.teamCount} csapat játszott{:else if g.is_practice}gyakorlás{:else}{g
									.venues?.name ?? 'nincs helyszín'} · {g.confirmedPlayers}{g.max_players
									? `/${g.max_players}`
									: ''} fő{/if}</small
						>
					</span>
					{#if bucket(g) === 'live'}<span class="ws-pill live">● Élő</span>
					{:else if bucket(g) === 'upcoming'}<span
							class="dot"
							class:on={g.is_public}
							title={g.is_public ? 'Nyilvános' : 'Nem nyilvános'}
						></span>{/if}
				{/snippet}
				{#snippet footer()}
					<button type="button" class="ws-btn outline" data-tour="games-create" onclick={openCreate}
						>+ Kvízeste <kbd class="ws-kbd">N</kbd></button
					>
					<form
						method="POST"
						action="?/createPractice"
						data-tour="games-practice"
						use:enhance={withToast({ setSubmitting: (v) => (creatingPractice = v) })}
					>
						<button type="submit" class="ws-btn" disabled={creatingPractice}
							>{creatingPractice ? 'Létrehozás…' : 'Próbaeste'}</button
						>
					</form>
				{/snippet}
			</RailList>
		</div>
	{/snippet}

	{#snippet main()}
		{#if form?.error}<p class="ws-note error">{form.error}</p>{/if}
		{#if selected}
			{@const g = selected}
			<div class="ws-crumb">Kvízesték › {g.is_practice ? 'Próbaeste' : STATUS[g.status]}</div>
			<div class="ws-head">
				<div>
					<h1 class="ws-h1">{g.title}</h1>
					<p class="ws-sub">
						{g.scheduled_at ? formatEventDate(g.scheduled_at) : 'Nincs időpont'}{g.venues?.name
							? ` · ${g.venues.name}${g.venues.city ? `, ${g.venues.city}` : ''}`
							: ''}
					</p>
				</div>
				<div class="pills">
					<span class="ws-pill" class:live={bucket(g) === 'live'} data-tour="games-status"
						>{STATUS[g.status] ?? g.status}</span
					>
					{#if g.is_practice}<span class="ws-pill">Próba</span>
					{:else if g.status === 'lobby'}<span class="ws-pill" class:ok={g.is_public}
							>{g.is_public ? 'Nyilvános' : 'Nem nyilvános'}</span
						>{/if}
				</div>
			</div>

			<div class="ws-tiles">
				{#if bucket(g) === 'upcoming'}
					<div class="ws-tile">
						Jelentkezett
						<strong>{g.confirmedPlayers}{g.max_players ? ` / ${g.max_players}` : ''} fő</strong>
						{#if g.max_players}
							<div class="ws-bar">
								<i style="width: {Math.min(100, (g.confirmedPlayers / g.max_players) * 100)}%"></i>
							</div>
						{/if}
					</div>
					<div class="ws-tile">
						Csapatok <strong>{g.confirmedTeams}</strong>
						{g.waitlistTeams ? `+${g.waitlistTeams} várólistán` : 'nincs várólista'}
					</div>
				{:else}
					<div class="ws-tile">Csapatok <strong>{g.teamCount}</strong> csatlakozott</div>
				{/if}
				<div class="ws-tile">
					Menetrend <strong>{g.rounds.length} kör · {questionCount(g)}</strong> kérdés
				</div>
				<div class="ws-tile">PIN <strong>{g.pin}</strong> csatlakozáshoz</div>
			</div>

			<div class="ws-card">
				<div class="ws-card-head">
					<h2>Menetrend</h2>
					<a href={resolve('/admin/games/[id]', { id: g.id })}
						>Megnyitás az összerakóban (Enter) →</a
					>
				</div>
				{#each g.rounds as round, i (round.id)}
					<div class="round-row">
						<span class="round-title">{i + 1}. {round.title}</span>
						<div class="ws-bar">
							<i style="width: {Math.min(100, (round.questions / 8) * 100)}%"></i>
						</div>
						<span class="round-count" class:warn={round.questions === 0}
							>{round.questions} kérdés</span
						>
					</div>
				{:else}
					<p class="ws-note">Még nincs kör — az összerakóban adhatsz hozzá (Shift+N).</p>
				{/each}
			</div>

			{#if todos.length > 0}
				<div class="ws-card">
					<h2>Teendők az estig</h2>
					{#each todos as todo (todo.text)}
						<div class="todo">
							<span class={todo.ok ? 'mark ok' : 'mark warn'}>{todo.ok ? '✓' : '!'}</span>
							<span class="todo-text">{todo.text}</span>
							{#if !todo.ok && todo.href}<a href={todo.href}>{todo.link} →</a>{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="ws-empty">
				<h2>Még nincs kvízeste</h2>
				<p>Hozz létre egyet (N), vagy próbáld ki a felületet egy Próbaestével.</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		{#if selected}
			{@const g = selected}
			<p class="ws-cap">Műveletek</p>
			<a class="ws-action primary" href={resolve('/admin/games/[id]', { id: g.id })}
				><span>Kvízösszerakó</span><kbd>Enter</kbd></a
			>
			<a class="ws-action" href={resolve('/admin/games/[id]/event', { id: g.id })}
				><span>Esemény és jelentkezések</span><kbd>E</kbd></a
			>
			<a class="ws-action" href={resolve('/admin/games/[id]/results', { id: g.id })}
				><span>Eredmények</span><kbd>R</kbd></a
			>
			<a class="ws-action" href={resolve('/host/[game_id]', { game_id: g.id })}
				><span>Élő lebonyolítás</span><kbd>L</kbd></a
			>
			<a
				class="ws-action"
				href={resolve('/tv/[game_id]', { game_id: g.id })}
				target="_blank"
				rel="noopener"><span>Kivetítő (új lap)</span><kbd>V</kbd></a
			>
			{#if g.status === 'finished' || isSuperAdmin}
				<p class="ws-cap">Ritkán</p>
			{/if}
			{#if g.status === 'finished'}
				<form
					method="POST"
					action="?/reopen"
					data-tour="games-reopen"
					use:enhance={withToast({
						successMessage: 'Kvízeste újranyitva — a Váró állapotból indítható újra.',
						setSubmitting: (v) => (reopening = v)
					})}
				>
					<input type="hidden" name="game_id" value={g.id} />
					<button type="submit" class="ws-action" disabled={reopening}
						><span>{reopening ? 'Újranyitás…' : 'Kvízeste újranyitása'}</span></button
					>
				</form>
			{/if}
			{#if isSuperAdmin}
				<div data-tour="games-delete">
					<DeleteGameButton
						gameId={g.id}
						title={g.title}
						running={g.status === 'active' || g.status === 'paused'}
						details={`${g.confirmedTeams} jelentkezés, ${g.teamCount} csapat`}
					/>
				</div>
			{/if}
			<p class="ws-note">
				Bal oldalt ↑/↓ lépked az esték között, Enter megnyitja az összerakót. Bárhonnan: Ctrl+K.
			</p>
		{/if}
	{/snippet}
</Workspace>

<dialog
	bind:this={createDialog}
	class="create-dialog"
	aria-labelledby="create-title"
	onclose={() => (creatingOpen = false)}
>
	<form
		method="POST"
		action="?/create"
		use:enhance={withToast({ setSubmitting: (v) => (creating = v) })}
	>
		<h2 id="create-title">Új kvízeste</h2>
		<label class="ws-field">
			<span>Név</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input name="title" bind:value={newTitle} required maxlength="120" autofocus />
		</label>
		<p class="ws-note">Létrehozás után az esemény adatai jönnek: időpont, helyszín, létszám.</p>
		<div class="dialog-actions">
			<button type="button" class="ws-btn" onclick={() => (creatingOpen = false)}>Mégse</button>
			<button type="submit" class="ws-btn primary" disabled={creating || !newTitle.trim()}
				>{creating ? 'Létrehozás…' : 'Létrehozás'}</button
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

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--field-border, #d5cec0);
	}

	.dot.on {
		background: var(--power);
	}

	.pills {
		display: flex;
		gap: 0.4rem;
	}

	.round-row {
		display: grid;
		grid-template-columns: minmax(0, 12rem) minmax(0, 1fr) 6rem;
		align-items: center;
		gap: 0.8rem;
		font-size: 0.9rem;
	}

	.round-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.round-count {
		text-align: right;
		color: var(--marquee-dim);
	}

	.round-count.warn {
		color: var(--coin);
		font-weight: 700;
	}

	.todo {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}

	.todo-text {
		flex: 1;
	}

	.mark {
		width: 1.2rem;
		font-weight: 800;
		text-align: center;
	}

	.mark.ok {
		color: var(--power);
	}

	.mark.warn {
		color: var(--coin);
	}

	.error {
		color: var(--danger);
	}

	.create-dialog {
		width: min(28rem, calc(100vw - 2rem));
		padding: 1.3rem 1.4rem;
		border: 0;
		border-radius: 1rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: 0 30px 60px rgb(0 0 0 / 25%);
	}

	.create-dialog::backdrop {
		background: rgb(28 27 24 / 40%);
	}

	.create-dialog form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.create-dialog h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	@media (max-width: 720px) {
		.round-row {
			grid-template-columns: minmax(0, 1fr) 5rem;
		}

		.round-row .ws-bar {
			display: none;
		}
	}
</style>
