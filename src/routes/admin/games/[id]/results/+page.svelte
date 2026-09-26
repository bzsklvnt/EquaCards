<script lang="ts">
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import GameHeader from '$lib/components/admin/GameHeader.svelte';
	import ReopenGameButton from '$lib/components/ReopenGameButton.svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import type { PageData } from './$types';

	// Részletes eredmények (csak kezelőknek, docs/features/staff-results.md) —
	// lista (kérdések körönként) · részlet (ki mit válaszolt) · állás.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'results');

	type Question = PageData['rounds'][number]['questions'][number] & { roundId: string };

	let search = $state('');
	const groups = $derived(
		data.rounds.map((round) => ({
			label: `${round.order_index}. ${round.title}`,
			items: round.questions
				.map((q) => ({ ...q, roundId: round.id }))
				.filter(
					(q) => !search.trim() || q.prompt.toLowerCase().includes(search.trim().toLowerCase())
				)
		}))
	);
	const selection = createSelection(
		'q',
		() => groups.find((g) => g.items.length > 0)?.items[0]?.question_id ?? null
	);
	const selected = $derived(
		groups.flatMap((g) => g.items).find((q) => q.question_id === selection.id) ??
			(null as Question | null)
	);
	const selectedRound = $derived(data.rounds.find((r) => r.id === selected?.roundId) ?? null);

	function totals(questions: PageData['rounds'][number]['questions']) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- helyi, nem reaktív összegzés
		const byTeam = new Map<string, { name: string; points: number; correct: number }>();
		for (const team of data.teams) byTeam.set(team.id, { name: team.name, points: 0, correct: 0 });
		for (const q of questions) {
			for (const t of q.teams) {
				const entry = byTeam.get(t.team_id);
				if (!entry) continue;
				entry.points += t.points_awarded ?? 0;
				if (t.is_correct) entry.correct += 1;
			}
		}
		return [...byTeam.values()].sort((a, b) => b.points - a.points);
	}

	const roundTotals = $derived(selectedRound ? totals(selectedRound.questions) : []);
	const gameTotals = $derived(totals(data.rounds.flatMap((r) => r.questions)));

	const correctCount = (q: Question) => q.teams.filter((t) => t.is_correct).length;

	function formatMs(ms: number | null): string {
		if (ms === null) return '—';
		return `${(ms / 1000).toFixed(1)} mp`;
	}
</script>

<svelte:head>
	<title>Eredmények — {data.game.title} — Kezelőfelület</title>
</svelte:head>

<div class="page">
	<GameHeader game={data.game} active="results">
		{#snippet status()}<span class="ws-saved busy">{data.teams.length} csapat</span>{/snippet}
		{#snippet actions()}
			{#if data.game.status === 'finished'}<ReopenGameButton gameId={data.game.id} />{/if}
		{/snippet}
	</GameHeader>

	<Workspace
		fill
		label="Eredmények"
		keys={[
			['↑ ↓', 'kérdések'],
			['/', 'keresés']
		]}
	>
		{#snippet rail()}
			<RailList
				label="Kérdések"
				{groups}
				getId={(q) => q.question_id}
				selectedId={selection.id}
				onselect={(q) => selection.set(q.question_id)}
				bind:search
				placeholder="Keresés a kérdésekben…"
				empty="Ehhez az estéhez még nincs kérdés vagy csapat."
			>
				{#snippet item(q)}
					<span class="ws-item-text">
						<strong>{q.order_index}. {q.prompt}</strong>
						<small>{correctCount(q)} / {q.teams.length} helyes</small>
					</span>
				{/snippet}
			</RailList>
		{/snippet}

		{#snippet main()}
			{#if selected}
				<div class="ws-crumb" data-tour="res-round">
					Eredmények › {selectedRound?.order_index}. {selectedRound?.title}
				</div>
				<h1 class="ws-h1">{selected.prompt}</h1>
				<p class="ws-note" data-tour="res-correct">
					Helyes válasz: <strong>{selected.correct_answer}</strong>
				</p>
				<div class="ws-card" data-tour="res-table">
					<table class="ws-table">
						<thead>
							<tr>
								<th>Csapat</th>
								<th>Beküldött válasz</th>
								<th>Helyes?</th>
								<th class="num">Pont</th>
								<th class="num">Idő</th>
							</tr>
						</thead>
						<tbody>
							{#each selected.teams as t (t.team_id)}
								<tr>
									<td>{t.team_name}</td>
									<td>{t.submitted ? t.submitted_answer : '(nem küldött választ)'}</td>
									<td>
										{#if t.is_correct === null}—{:else if t.is_correct}<span class="yes">Igen</span
											>{:else}<span class="no">Nem</span>{/if}
									</td>
									<td class="num">{t.points_awarded ?? '—'}</td>
									<td class="num">{formatMs(t.answer_time_ms)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="ws-empty">
					<h2>Még nincs eredmény</h2>
					<p>Ehhez az estéhez még nincs kör, kérdés vagy csatlakozott csapat.</p>
				</div>
			{/if}
		{/snippet}

		{#snippet side()}
			{#if selectedRound}
				<p class="ws-cap">{selectedRound.order_index}. kör állása</p>
				<ol class="totals">
					{#each roundTotals as row, i (row.name + i)}
						<li><span>{i + 1}. {row.name}</span><b>{row.points}</b></li>
					{/each}
				</ol>
			{/if}
			<p class="ws-cap">Az este összesen</p>
			<ol class="totals">
				{#each gameTotals as row, i (row.name + i)}
					<li>
						<span>{i + 1}. {row.name}</span><b>{row.points}</b><small>{row.correct} helyes</small>
					</li>
				{/each}
			</ol>
			<p class="ws-note">
				Ez a bontás csak a kezelői felületen látszik — a kivetítő és a csapatok nem kapják meg.
			</p>
		{/snippet}
	</Workspace>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	.yes {
		color: var(--power);
		font-weight: 700;
	}

	.no {
		color: var(--danger);
		font-weight: 700;
	}

	.totals {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
	}

	.totals li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: 0.5rem;
		background: var(--cabinet);
	}

	.totals span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.totals small {
		color: var(--marquee-dim);
	}

	@media (max-width: 1100px) {
		.page {
			height: auto;
			min-height: 100dvh;
		}
	}
</style>
