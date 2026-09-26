<script lang="ts">
	import { registerPageTour } from '$lib/tours/state.svelte';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import ReportsRail from '$lib/components/admin/ReportsRail.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import type { PageData } from './$types';

	// Egy lezárult este végeredménye — ugyanaz a lista · részlet · oldalsáv
	// elrendezés, mint a kezelői felületen (docs/features/admin-workspace.md).
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'report-detail');

	const total = $derived(data.leaderboard.reduce((sum, r) => sum + (r.total_score ?? 0), 0));
</script>

<svelte:head>
	<title>{data.game.title} — Riportok</title>
</svelte:head>

<Workspace
	label="Riport"
	keys={[
		['↑ ↓', 'esték'],
		['/', 'keresés']
	]}
>
	{#snippet rail()}
		<ReportsRail games={data.games} selectedId={data.game.id} />
	{/snippet}

	{#snippet main()}
		<div class="ws-crumb">Riportok › <b>{data.game.title}</b></div>
		<h1 class="ws-h1">{data.game.title}</h1>
		<p class="ws-sub">
			{data.game.finished_at ? new Date(data.game.finished_at).toLocaleDateString('hu-HU') : '—'} ·
			{data.leaderboard.length} csapat
		</p>
		<div class="podium" data-tour="rd-podium">
			{#each data.leaderboard as row, i (row.team_id)}
				<PodiumCard rank={i + 1} name={row.name} score={row.total_score} />
			{:else}
				<p class="ws-note">Ehhez az estéhez nincs csapat-adat.</p>
			{/each}
		</div>
	{/snippet}

	{#snippet side()}
		<p class="ws-cap">Összesítés</p>
		<div class="ws-tiles">
			<div class="ws-tile">Csapatok <strong>{data.leaderboard.length}</strong></div>
			<div class="ws-tile">
				Átlagpont <strong
					>{data.leaderboard.length ? Math.round(total / data.leaderboard.length) : 0}</strong
				>
			</div>
		</div>
		{#if data.leaderboard[0]}
			<p class="ws-note">Győztes: <b>{data.leaderboard[0].name}</b></p>
		{/if}
	{/snippet}
</Workspace>

<style>
	.podium {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 40rem;
	}
</style>
