<script lang="ts">
	import type { QuestionStandingsRow } from '$lib/realtime/protocol';
	import { neighbours } from '$lib/realtime/standings';

	// A csapat saját köri állása a telefonon: felső sáv (végig a játék alatt,
	// csak felfedés után frissül) vagy részletes kártya (felfedés után) az
	// előtte és mögötte álló csapattal és a pontkülönbségekkel.
	let {
		rows,
		teamId,
		variant = 'strip'
	}: {
		rows: QuestionStandingsRow[];
		teamId: string;
		variant?: 'strip' | 'card';
	} = $props();

	const n = $derived(neighbours(rows, teamId));
	const fmt = (v: number) => v.toLocaleString('hu-HU');

	const aheadText = $derived.by(() => {
		if (!n) return '';
		if (!n.ahead)
			return n.behind ? `${fmt(n.me.score - n.behind.score)} ponttal vezettek` : 'Vezettek';
		const gap = n.ahead.score - n.me.score;
		return gap === 0
			? `holtverseny: ${n.ahead.name}`
			: `${fmt(gap)} pont kell a ${n.ahead.rank}. helyhez`;
	});

	const behindText = $derived.by(() => {
		if (!n?.behind || !n.ahead) return '';
		const gap = n.me.score - n.behind.score;
		return gap === 0
			? `holtverseny: ${n.behind.name}`
			: `${fmt(gap)} ponttal a ${n.behind.rank}. előtt`;
	});
</script>

{#if variant === 'strip'}
	<div class="strip" aria-live="polite" data-testid="round-strip">
		{#if n}
			<span class="rank">{n.me.rank}.</span>
			<span class="main">
				<span class="label">a körben · {n.total} csapat</span>
				<strong>{fmt(n.me.score)} pont</strong>
			</span>
			<span class="gaps">
				<span>{aheadText}</span>
				{#if behindText}<span>{behindText}</span>{/if}
			</span>
		{:else}
			<span class="main"><span class="label">Köri állás</span><strong>Még nincs pont</strong></span>
		{/if}
	</div>
{:else if n}
	<div class="card" data-testid="round-card">
		<h3>Állásotok a körben</h3>
		{#if n.ahead}
			<div class="row">
				<span class="r">{n.ahead.rank}.</span><span class="name">{n.ahead.name}</span><span
					>{fmt(n.ahead.score)}</span
				>
			</div>
			<p class="gap up">
				{n.ahead.score === n.me.score
					? 'holtversenyben vagytok'
					: `↑ ${fmt(n.ahead.score - n.me.score)} pont a(z) ${n.ahead.rank}. helyig`}
			</p>
		{/if}
		<div class="row me">
			<span class="r">{n.me.rank}.</span><span class="name">{n.me.name} (ti)</span><span
				>{fmt(n.me.score)}</span
			>
		</div>
		{#if n.behind}
			<p class="gap down">
				{n.behind.score === n.me.score
					? 'holtversenyben vagytok'
					: `↓ ${fmt(n.me.score - n.behind.score)} ponttal vezettek előtte`}
			</p>
			<div class="row">
				<span class="r">{n.behind.rank}.</span><span class="name">{n.behind.name}</span><span
					>{fmt(n.behind.score)}</span
				>
			</div>
		{/if}
	</div>
{/if}

<style>
	.strip {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1rem;
		border-radius: 0.8rem;
		background: var(--marquee);
		color: var(--cabinet-2);
		text-align: left;
	}

	.rank {
		font-family: var(--font-display);
		font-size: 1.6rem;
		line-height: 1;
	}

	.main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.label {
		font-size: 0.72rem;
		opacity: 0.75;
	}

	.gaps {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.72rem;
		line-height: 1.35;
		opacity: 0.9;
		text-align: right;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 1rem 0;
		text-align: left;
	}

	h3 {
		margin: 0 0 0.3rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border: var(--panel-border-width, 1px) solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.7rem;
		background: var(--cabinet-2);
	}

	.row.me {
		border: 0;
		background: var(--cyan);
		color: var(--on-primary, #fff);
		font-weight: 700;
	}

	.r {
		min-width: 1.6rem;
		font-weight: 700;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gap {
		margin: 0;
		text-align: center;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.gap.up {
		color: var(--coin);
	}

	.gap.down {
		color: var(--power);
	}
</style>
