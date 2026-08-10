<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatMs(ms: number | null): string {
		if (ms === null) return '—';
		return `${(ms / 1000).toFixed(1)} mp`;
	}
</script>

<svelte:head>
	<title>Részletes eredmények — {data.game.title} — Kezelőfelület</title>
</svelte:head>

<Button variant="ghost" href={resolve('/admin/games/[id]', { id: data.game.id })}>← Vissza</Button>

<h1>Részletes eredmények — {data.game.title}</h1>
<p class="status">Állapot: {data.game.status} · {data.teams.length} csapat</p>

{#if data.rounds.length === 0}
	<p class="empty">Ehhez az estéhez még nincs kör/kérdés vagy csapat.</p>
{:else}
	{#each data.rounds as round (round.id)}
		<section class="round">
			<h2>{round.order_index}. {round.title}</h2>
			{#each round.questions as question (question.question_id)}
				<div class="question">
					<p class="prompt">
						{question.order_index}. {question.prompt}
					</p>
					<p class="correct-answer">Helyes válasz: <strong>{question.correct_answer}</strong></p>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Csapat</th>
									<th>Beküldött válasz</th>
									<th>Helyes?</th>
									<th>Pont</th>
									<th>Idő</th>
								</tr>
							</thead>
							<tbody>
								{#each question.teams as t (t.team_id)}
									<tr>
										<td data-label="Csapat">{t.team_name}</td>
										<td data-label="Beküldött válasz">
											{t.submitted ? t.submitted_answer : '(nem küldött választ)'}
										</td>
										<td data-label="Helyes?">
											{#if t.is_correct === null}
												—
											{:else if t.is_correct}
												<span class="correct">Igen</span>
											{:else}
												<span class="incorrect">Nem</span>
											{/if}
										</td>
										<td data-label="Pont">{t.points_awarded ?? '—'}</td>
										<td data-label="Idő">{formatMs(t.answer_time_ms)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<p class="empty">Ebben a körben nincs kérdés.</p>
			{/each}
		</section>
	{/each}
{/if}

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
		margin-top: 1rem;
	}

	h2 {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1rem;
		color: var(--marquee);
	}

	.status {
		color: var(--marquee-dim);
		margin-bottom: 1rem;
	}

	.round {
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.question {
		margin-bottom: 1.5rem;
	}

	.question:last-child {
		margin-bottom: 0;
	}

	.prompt {
		font-weight: 600;
		color: var(--marquee);
		margin-bottom: 0.25rem;
	}

	.correct-answer {
		color: var(--power);
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--cabinet-3);
	}

	th {
		color: var(--marquee-dim);
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
	}

	td {
		color: var(--marquee);
	}

	.correct {
		color: var(--power);
		font-weight: 600;
	}

	.incorrect {
		color: var(--danger);
		font-weight: 600;
	}

	.empty {
		color: var(--marquee-dim);
	}

	/* Fázis N3 mintája — 640px alatt kártyás nézetté alakul, mert
	   oszloponként vízszintesen csúnyán törne/scrollózna mobilon. */
	@media (max-width: 640px) {
		thead {
			display: none;
		}

		table,
		tbody,
		tr,
		td {
			display: block;
			width: 100%;
		}

		tr {
			background: var(--cabinet);
			border: 1px solid var(--cabinet-3);
			border-radius: 0.5rem;
			padding: 0.5rem;
			margin-bottom: 0.5rem;
		}

		td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 1rem;
			border-bottom: 1px solid var(--cabinet-3);
			text-align: right;
		}

		td:last-child {
			border-bottom: none;
		}

		td::before {
			content: attr(data-label);
			color: var(--marquee-dim);
			font-size: 0.8rem;
			text-align: left;
		}
	}
</style>
