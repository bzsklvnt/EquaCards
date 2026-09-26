<script lang="ts">
	import { registerPageTour } from '$lib/tours/state.svelte';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import ReportsRail from '$lib/components/admin/ReportsRail.svelte';
	import { defaultTokens } from '$lib/theme/tokens';
	import ReportChart from '$lib/components/ReportChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Fázis O5 — az oldal a reports/+layout.svelte (DashboardShell) héjában
	// renderel, ami már felveszi a témát és a hátteret a saját gyökér
	// elemén (CSS custom property-k lefelé öröklődnek) — itt csak a
	// ReportChart-nak kellő tényleges (nem var()) szín-értékekre van
	// szükség, nincs saját <main>/style wrapper többé. A kezelői héj mindig
	// a letisztult alaptémát használja.
	const tokens = defaultTokens;

	// A vonaldiagram idősorrendben (legrégebbi → legújabb) olvasandó, míg a
	// lista alul a legfrissebb estét mutatja legfelül — ezért két külön
	// sorrend ugyanabból az adatból.
	let chronological = $derived([...data.finishedGames].reverse());
	let teamCountLabels = $derived(
		chronological.map((g) =>
			g.finished_at ? new Date(g.finished_at).toLocaleDateString('hu-HU') : '—'
		)
	);
	let teamCountData = $derived(chronological.map((g) => g.team_count));
	let avgTeamCount = $derived(
		data.finishedGames.length
			? (
					data.finishedGames.reduce((sum, g) => sum + g.team_count, 0) / data.finishedGames.length
				).toFixed(1)
			: '0'
	);

	registerPageTour(() => 'reports');
</script>

<svelte:head>
	<title>Riportok — EquaCards</title>
</svelte:head>

<Workspace
	label="Riportok"
	keys={[
		['↑ ↓', 'esték'],
		['/', 'keresés']
	]}
>
	{#snippet rail()}
		<ReportsRail games={data.finishedGames} selectedId="summary" />
	{/snippet}

	{#snippet main()}
		<div class="ws-crumb">Riportok › <b>Összesítés</b></div>
		<h1 class="ws-h1">Riportok</h1>
		<div class="ws-tiles" data-tour="rp-stats">
			<div class="ws-tile">Lezárult este <strong>{data.finishedGames.length}</strong></div>
			<div class="ws-tile">Átlagos csapatszám <strong>{avgTeamCount}</strong></div>
		</div>
		{#if data.finishedGames.length > 0}
			<div class="ws-card">
				<h2>Csapatszám trendje esténként</h2>
				<ReportChart
					type="line"
					labels={teamCountLabels}
					data={teamCountData}
					label="Csapatok száma"
					color={tokens['--cyan']}
					gridColor={tokens['--cabinet-3']}
					textColor={tokens['--marquee-dim']}
					yStepSize={1}
				/>
			</div>
		{/if}
		{#if data.designThemeUsage.length > 0}
			<div class="ws-card">
				<h2>Leggyakrabban használt vizuális témák</h2>
				<ReportChart
					type="bar"
					labels={data.designThemeUsage.map((t) => t.title)}
					data={data.designThemeUsage.map((t) => t.usage_count)}
					label="Használat"
					color={tokens['--violet']}
					gridColor={tokens['--cabinet-3']}
					textColor={tokens['--marquee-dim']}
				/>
			</div>
		{/if}
		{#if data.contentThemeUsage.length > 0}
			<div class="ws-card">
				<h2>Leggyakrabban használt tartalmi témák</h2>
				<ReportChart
					type="bar"
					labels={data.contentThemeUsage.map((t) => t.title)}
					data={data.contentThemeUsage.map((t) => t.usage_count)}
					label="Használat"
					color={tokens['--coin']}
					gridColor={tokens['--cabinet-3']}
					textColor={tokens['--marquee-dim']}
				/>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		<p class="ws-cap">Átlagos válaszidő kérdéstípusonként</p>
		{#each data.avgResponseTimes as row (row.question_type)}
			<div class="rt"><span>{row.question_type}</span><b>{row.avg_seconds} mp</b></div>
		{:else}
			<p class="ws-note">Még nincs adat.</p>
		{/each}
		<p class="ws-note">
			Szia, {data.profile.display_name}! Bal oldalt egy estére lépve látod a végeredményét.
		</p>
	{/snippet}
</Workspace>

<style>
	.rt {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
	}
</style>
