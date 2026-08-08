<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		defaultTokens,
		getActiveTokens,
		tokensToCssText,
		resolveTokens
	} from '$lib/theme/tokens';
	import ReportChart from '$lib/components/ReportChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let themeCss = $state(tokensToCssText(defaultTokens));
	let tokens = $state(resolveTokens(null));

	onMount(() => {
		getActiveTokens(data.supabase, null).then((resolved) => {
			tokens = resolved;
			themeCss = tokensToCssText(resolved);
		});
	});

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
</script>

<svelte:head>
	<title>Riportok — EquaCards</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<h1>Riportok</h1>
	<p class="intro">
		Szia, {data.profile.display_name}! Lezárult kvízesték eredményei és statisztikái.
	</p>

	<section class="stats">
		<h2>Aggregált statisztikák</h2>

		<div class="stat-grid">
			<div class="stat-card">
				<span class="stat-value">{data.finishedGames.length}</span>
				<span class="stat-label">Lezárult este</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{avgTeamCount}</span>
				<span class="stat-label">Átlagos csapatszám esténként</span>
			</div>
		</div>

		{#if data.finishedGames.length > 0}
			<div class="chart-block">
				<h3>Csapatszám trendje esténként</h3>
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
			<div class="chart-block">
				<h3>Leggyakrabban használt vizuális témák</h3>
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
			<div class="chart-block">
				<h3>Leggyakrabban használt tartalmi témák</h3>
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

		{#if data.avgResponseTimes.length > 0}
			<div class="response-times">
				<h3>Átlagos válaszidő kérdéstípusonként</h3>
				<ul>
					{#each data.avgResponseTimes as row (row.question_type)}
						<li><span>{row.question_type}</span><span class="value">{row.avg_seconds} mp</span></li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<section class="games">
		<h2>Lezárult kvízesték</h2>
		<div class="game-list">
			{#each data.finishedGames as game (game.id)}
				<a class="game-row" href={resolve('/reports/[game_id]', { game_id: game.id })}>
					<span class="game-title">{game.title}</span>
					<span class="game-meta">
						{game.finished_at ? new Date(game.finished_at).toLocaleDateString('hu-HU') : '—'} · {game.team_count}
						csapat
					</span>
				</a>
			{:else}
				<p class="empty">Még nincs lezárult kvízeste.</p>
			{/each}
		</div>
	</section>
</main>

<style>
	main.cabinet {
		min-height: 100vh;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		padding: 2rem;
		max-width: 56rem;
		margin: 0 auto;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--cyan);
	}

	.intro {
		color: var(--marquee-dim);
	}

	h2 {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--coin);
		margin-top: 2rem;
		border-bottom: 2px solid var(--cabinet-3);
		padding-bottom: 0.5rem;
	}

	h3 {
		font-size: 0.95rem;
		color: var(--marquee-dim);
		margin: 1.5rem 0 0.75rem;
	}

	.stat-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1rem;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		padding: 1rem 1.5rem;
		min-width: 10rem;
	}

	.stat-value {
		font-family: var(--font-led);
		font-size: 2rem;
		color: var(--coin);
	}

	.stat-label {
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	.chart-block {
		margin-top: 1rem;
	}

	.response-times ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.response-times li {
		display: flex;
		justify-content: space-between;
		background: var(--cabinet-2);
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
	}

	.response-times .value {
		font-family: var(--font-led);
		color: var(--power);
	}

	.game-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.game-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.5rem;
		padding: 0.75rem 1.25rem;
		color: var(--marquee);
		text-decoration: none;
	}

	.game-row:hover {
		border-color: var(--cyan);
	}

	.game-row:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.game-title {
		font-weight: 600;
	}

	.game-meta {
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	.empty {
		color: var(--marquee-dim);
	}
</style>
