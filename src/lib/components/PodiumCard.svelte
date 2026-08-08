<script lang="ts">
	let {
		rank,
		name,
		score,
		scoreLabel = 'pont',
		own = false
	}: {
		rank: number;
		name: string;
		score: number;
		scoreLabel?: string;
		own?: boolean;
	} = $props();

	let medal = $derived(rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '');
</script>

<div class="podium-card" class:own class:top3={rank <= 3}>
	<span class="rank">{medal || `${rank}.`}</span>
	<span class="name">{name}</span>
	<span class="score">{score} {scoreLabel}</span>
</div>

<style>
	.podium-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--cabinet-2);
		border: 2px solid var(--marquee-dim);
		border-radius: 0.75rem;
		padding: 0.75rem 1.25rem;
		font-family: var(--font-body);
	}

	.podium-card.top3 {
		border-color: var(--coin);
	}

	.podium-card.own {
		border-color: var(--cyan);
		box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 40%, transparent);
	}

	.rank {
		font-family: var(--font-led);
		color: var(--coin);
		width: 2.5ch;
		font-size: 1.1em;
	}

	.name {
		flex: 1;
		text-align: left;
		color: var(--marquee);
	}

	.podium-card.own .name {
		color: var(--cyan);
		font-weight: bold;
	}

	.score {
		color: var(--power);
		font-weight: bold;
	}
</style>
