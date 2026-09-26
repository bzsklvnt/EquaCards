<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import { eventDateParts, formatEventDate } from '$lib/datetime';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Vezérlőpult — a következő esték · a kijelölt este röviden · gyors
	// műveletek. docs/features/admin-workspace.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'dashboard');

	const selection = createSelection('id', () => data.upcoming[0]?.id ?? null);
	const selected = $derived(data.upcoming.find((g) => g.id === selection.id) ?? null);

	const greeting = (() => {
		const hour = Number(
			new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit' })
		);
		return hour < 10 ? 'Jó reggelt!' : hour < 18 ? 'Szép napot!' : 'Jó estét!';
	})();

	const daysUntil = (iso: string | null) => {
		if (!iso) return null;
		const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
		return days <= 0 ? 'ma' : days === 1 ? 'holnap' : `${days} nap múlva`;
	};

	const totalPlayers = $derived(data.upcoming.reduce((sum, g) => sum + g.confirmedPlayers, 0));
</script>

<svelte:head>
	<title>Vezérlőpult — Kezelőfelület</title>
</svelte:head>

<Workspace
	label="Vezérlőpult"
	keys={[
		['↑ ↓', 'esték'],
		['Enter', 'megnyitás'],
		['G E', 'Kvízesték'],
		['G K', 'Kérdésbank']
	]}
>
	{#snippet rail()}
		<RailList
			label="Következő esték"
			groups={[{ label: 'Következő esték', items: data.upcoming }]}
			getId={(g) => g.id}
			selectedId={selection.id}
			onselect={(g) => selection.set(g.id)}
			onopen={(g) => goto(`${resolve('/admin/games')}?id=${g.id}`)}
			empty="Nincs időponttal meghirdetett este."
		>
			{#snippet item(g)}
				{#if g.scheduled_at}
					{@const d = eventDateParts(g.scheduled_at)}
					<span class="ws-date"><b>{d.day}</b><small>{d.month}</small></span>
				{/if}
				<span class="ws-item-text">
					<strong>{g.title}</strong>
					<small
						>{g.confirmedPlayers}{g.max_players ? `/${g.max_players}` : ''} fő · {g.venues?.name ??
							'nincs helyszín'}</small
					>
				</span>
			{/snippet}
			{#snippet footer()}
				<a class="ws-btn outline" href={`${resolve('/admin/games')}?new=1`}>+ Kvízeste</a>
				<a class="ws-btn" href={resolve('/admin/games')}>Összes este</a>
			{/snippet}
		</RailList>
	{/snippet}

	{#snippet main()}
		<h1 class="ws-h1">{greeting}</h1>
		<p class="ws-sub">
			Első alkalommal indítsd el a „Bemutató ▶” gombot fent — minden oldalnak saját bemutatója van.
			Bárhonnan: <kbd>Ctrl K</kbd> keresés, <kbd>?</kbd> billentyűparancsok.
		</p>
		{#each data.live as g (g.id)}
			<a class="live" href={resolve('/host/[game_id]', { game_id: g.id })}
				><span class="ws-pill live">● Élő most</span> {g.title} — vissza a lebonyolításhoz →</a
			>
		{/each}
		<div class="ws-tiles">
			<div class="ws-tile">
				Következő este <strong>{daysUntil(data.upcoming[0]?.scheduled_at ?? null) ?? '—'}</strong>
			</div>
			<div class="ws-tile">Jelentkezett (közelgő esték) <strong>{totalPlayers} fő</strong></div>
			<div class="ws-tile">Kérdésbank <strong>{data.questionCount}</strong></div>
			<div class="ws-tile">Még nem játszott <strong>{data.freshCount}</strong></div>
		</div>
		{#if selected}
			<div class="ws-card" data-tour="next-games">
				<div class="ws-card-head">
					<h2>{selected.title}</h2>
					<span class="ws-pill" class:ok={selected.is_public}
						>{selected.is_public ? 'Nyilvános' : 'Nem nyilvános'}</span
					>
				</div>
				<p class="ws-sub">
					{selected.scheduled_at ? formatEventDate(selected.scheduled_at) : ''}{selected.venues
						?.name
						? ` · ${selected.venues.name}`
						: ''}
				</p>
				{#if selected.max_players}
					<div class="ws-bar">
						<i
							style="width: {Math.min(
								100,
								(selected.confirmedPlayers / selected.max_players) * 100
							)}%"
						></i>
					</div>
				{/if}
				<p class="ws-sub">
					{selected.confirmedPlayers}{selected.max_players ? ` / ${selected.max_players}` : ''} fő ·
					{selected.confirmedTeams} csapat{selected.waitlistTeams
						? ` · ${selected.waitlistTeams} várólistán`
						: ''}
				</p>
				<div class="actions">
					<a class="ws-btn primary" href={resolve('/admin/games/[id]', { id: selected.id })}
						>Kvízösszerakó</a
					>
					<a class="ws-btn" href={resolve('/admin/games/[id]/event', { id: selected.id })}
						>Esemény és jelentkezések</a
					>
				</div>
			</div>
		{:else}
			<div class="ws-card">
				<h2>Nincs meghirdetett este</h2>
				<p class="ws-sub">
					Hozz létre egyet a Kvízesték oldalon, és add meg az időpontot, a helyszínt és a
					létszámkorlátot.
				</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		<p class="ws-cap">Gyors műveletek</p>
		<a class="ws-action" href={`${resolve('/admin/games')}?new=1`}><span>Új kvízeste</span></a>
		<a class="ws-action" href={`${resolve('/admin/questions')}?new=1`}><span>Új kérdés</span></a>
		<a class="ws-action" href={resolve('/admin/games')}><span>Próbaeste a gyakorláshoz</span></a>
		<a class="ws-action" href={resolve('/reports')}><span>Riportok</span></a>
		<p class="ws-note">
			Minden oldal ugyanúgy épül fel: bal oldalt a lista (↑/↓, / szűrés), középen a részletek, jobb
			oldalt a műveletek — a változások automatikusan mentődnek.
		</p>
	{/snippet}
</Workspace>

<style>
	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}

	.live {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.9rem;
		border-radius: 0.8rem;
		background: color-mix(in srgb, var(--danger) 8%, var(--cabinet-2));
		color: var(--marquee);
		font-weight: 600;
		text-decoration: none;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
