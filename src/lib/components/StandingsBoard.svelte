<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { QuestionStandingsRow } from '$lib/realtime/protocol';

	// Kérdésenkénti állás a körön belül (host, TV, csapat) — helyezés,
	// helyezés-változás, a kérdésnél szerzett pont és a köri összpont.
	let {
		rows,
		limit = 5,
		ownTeamId = null,
		size = 'md'
	}: {
		rows: QuestionStandingsRow[];
		limit?: number;
		/** A saját csapat sora kiemelve; ha nincs a látható részben, alul külön is megjelenik. */
		ownTeamId?: string | null;
		size?: 'md' | 'lg';
	} = $props();

	const visible = $derived(rows.slice(0, limit));
	const ownOutside = $derived(
		ownTeamId && !visible.some((r) => r.team_id === ownTeamId)
			? (rows.find((r) => r.team_id === ownTeamId) ?? null)
			: null
	);

	function movement(row: QuestionStandingsRow): { dir: 'up' | 'down' | 'same'; by: number } {
		if (row.prev_rank === null || row.prev_rank === row.rank) return { dir: 'same', by: 0 };
		return row.prev_rank > row.rank
			? { dir: 'up', by: row.prev_rank - row.rank }
			: { dir: 'down', by: row.rank - row.prev_rank };
	}
</script>

{#snippet line(row: QuestionStandingsRow, i: number)}
	{@const move = movement(row)}
	<li
		class="row"
		class:own={row.team_id === ownTeamId}
		class:top={row.rank === 1}
		in:fly={{ x: -24, delay: i * 90, duration: 280 }}
	>
		<span class="rank">{row.rank}.</span>
		<span
			class="move {move.dir}"
			aria-label={move.dir === 'up'
				? `${move.by} helyet javított`
				: move.dir === 'down'
					? `${move.by} helyet rontott`
					: 'nem változott'}
			>{move.dir === 'up' ? `▲${move.by}` : move.dir === 'down' ? `▼${move.by}` : '–'}</span
		>
		<span class="name">{row.name}</span>
		<span class="gained">{row.gained > 0 ? `+${row.gained}` : ''}</span>
		<span class="score">{row.score}</span>
	</li>
{/snippet}

<ol class="board {size}">
	{#each visible as row, i (row.team_id)}
		{@render line(row, i)}
	{/each}
	{#if ownOutside}
		<li class="gap" aria-hidden="true">⋯</li>
		{@render line(ownOutside, visible.length)}
	{/if}
</ol>

<style>
	.board {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 100%;
	}

	.row {
		display: grid;
		grid-template-columns: 2.5rem 3rem minmax(0, 1fr) auto 5rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 1rem;
		border-radius: 0.75rem;
		background: var(--cabinet-2);
		border: var(--panel-border-width, 2px) solid var(--panel-border, var(--marquee-dim));
		color: var(--marquee);
		font-family: var(--font-body);
	}

	.row.top {
		border-color: var(--coin);
	}

	.row.own {
		border-color: var(--cyan);
		box-shadow: 0 0 calc(12px * var(--glow, 1)) color-mix(in srgb, var(--cyan) 40%, transparent);
	}

	.rank {
		font-family: var(--font-led);
		font-weight: 700;
		color: var(--coin);
	}

	.move {
		font-size: 0.85rem;
		font-weight: 700;
		text-align: center;
		color: var(--marquee-dim);
	}

	.move.up {
		color: var(--power);
	}

	.move.down {
		color: var(--danger);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}

	.gained {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--power);
	}

	.score {
		font-family: var(--font-led);
		font-weight: 700;
		text-align: right;
	}

	.gap {
		text-align: center;
		color: var(--marquee-dim);
		line-height: 1;
	}

	.lg .row {
		padding: 0.9rem 1.4rem;
		font-size: clamp(1.1rem, 2.4vh, 1.6rem);
		grid-template-columns: 3.5rem 4rem minmax(0, 1fr) auto 7rem;
	}

	.lg .move {
		font-size: 0.8em;
	}

	/* Telefonon a név kapja a helyet: keskenyebb oszlopok, kisebb térköz. */
	@media (max-width: 520px) {
		.md .row {
			grid-template-columns: 1.6rem 1.8rem minmax(0, 1fr) auto 3.2rem;
			gap: 0.4rem;
			padding: 0.55rem 0.7rem;
			font-size: 0.95rem;
		}

		.md .gained {
			font-size: 0.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.row {
			transition: none;
		}
	}
</style>
