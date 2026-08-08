<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let themeCss = $state(tokensToCssText(defaultTokens));

	onMount(() => {
		getActiveTokens(data.supabase, null).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});
</script>

<svelte:head>
	<title>{data.game.title} — Riportok</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<Button variant="ghost" href={resolve('/reports')}>← Vissza a riportokhoz</Button>

	<h1>{data.game.title}</h1>
	<p class="meta">
		{data.game.finished_at ? new Date(data.game.finished_at).toLocaleDateString('hu-HU') : '—'} ·
		{data.leaderboard.length} csapat
	</p>

	<div class="podium-list">
		{#each data.leaderboard as row, i (row.team_id)}
			<PodiumCard rank={i + 1} name={row.name} score={row.total_score} />
		{:else}
			<p class="empty">Ehhez az estéhez nincs csapat-adat.</p>
		{/each}
	</div>
</main>

<style>
	main.cabinet {
		min-height: 100vh;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		padding: 2rem;
		max-width: 40rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--cyan);
		margin: 0;
	}

	.meta {
		color: var(--marquee-dim);
		margin: 0 0 1rem;
	}

	.podium-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty {
		color: var(--marquee-dim);
	}
</style>
