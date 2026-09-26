<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RailList from './RailList.svelte';

	// A Riportok bal oldali listája: összesítés + lezárult esték (a /reports és
	// a /reports/[game_id] közös sávja) — docs/features/admin-workspace.md.
	type Game = { id: string; title: string; finished_at: string | null; team_count: number };
	let { games, selectedId }: { games: Game[]; selectedId: string } = $props();

	let search = $state('');
	const SUMMARY = { id: 'summary', title: 'Összesítés', finished_at: null, team_count: -1 };
	const groups = $derived([
		{ items: [SUMMARY] },
		{
			label: 'Lezárult esték',
			items: games.filter((g) => g.title.toLowerCase().includes(search.trim().toLowerCase()))
		}
	]);

	function open(g: Game) {
		void goto(
			g.id === 'summary' ? resolve('/reports') : resolve('/reports/[game_id]', { game_id: g.id }),
			{ keepFocus: true, noScroll: true }
		);
	}
</script>

<div class="wrap" data-tour="rp-games">
	<RailList
		label="Riportok"
		{groups}
		getId={(g) => g.id}
		{selectedId}
		onselect={open}
		bind:search
		placeholder="Este keresése…"
		empty="Még nincs lezárult kvízeste."
	>
		{#snippet item(g)}
			<span class="ws-item-text">
				<strong>{g.title}</strong>
				<small
					>{g.id === 'summary'
						? 'statisztikák és grafikonok'
						: `${g.finished_at ? new Date(g.finished_at).toLocaleDateString('hu-HU') : '—'} · ${g.team_count} csapat`}</small
				>
			</span>
		{/snippet}
	</RailList>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}
</style>
