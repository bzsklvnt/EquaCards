<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import { formatEventDate } from '$lib/datetime';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'dashboard');
</script>

<svelte:head>
	<title>Vezérlőpult — Kezelőfelület</title>
</svelte:head>

<h1>Vezérlőpult</h1>
<p class="intro">
	Első alkalommal indítsd el a jobb felső „Bemutató ▶” gombot — minden oldalnak saját bemutatója
	van.
</p>

<section aria-labelledby="next-title">
	<div class="section-head">
		<h2 id="next-title">Következő esték</h2>
		<Button variant="secondary" href={resolve('/admin/games')}>Összes kvízeste</Button>
	</div>

	{#if data.upcoming.length === 0}
		<p class="empty">
			Nincs időponttal meghirdetett este. Hozz létre egyet a Kvízesték oldalon, és add meg az
			időpontot, a helyszínt és a létszámkorlátot.
		</p>
	{:else}
		<ul class="list">
			{#each data.upcoming as game (game.id)}
				<li>
					<div class="info">
						<a href={resolve('/admin/games/[id]/event', { id: game.id })}>{game.title}</a>
						<span class="muted">
							{game.scheduled_at ? formatEventDate(game.scheduled_at) : ''}{game.venues?.name
								? ` · ${game.venues.name}`
								: ''}
						</span>
					</div>
					<div class="count">
						<strong
							>{game.confirmedPlayers}{game.max_players ? ` / ${game.max_players}` : ''} fő</strong
						>
						<span class="muted"
							>{game.waitlistTeams ? `${game.waitlistTeams} várólistán` : 'nincs várólista'}</span
						>
					</div>
					<span class="badge" class:public={game.is_public}
						>{game.is_public ? 'Nyilvános' : 'Nem nyilvános'}</span
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	h1 {
		margin: 0.5rem 0 0.25rem;
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	.intro {
		margin: 0 0 2rem;
		color: var(--marquee-dim);
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.empty {
		padding: 1.5rem;
		border: 1px dashed var(--field-border, var(--marquee-dim));
		border-radius: 0.75rem;
		color: var(--marquee-dim);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 11rem 8rem;
		gap: 1rem;
		align-items: center;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--panel-border, var(--cabinet-3));
	}

	li:last-child {
		border-bottom: 0;
	}

	.info,
	.count {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.info a {
		color: var(--marquee);
		font-weight: 600;
	}

	.muted {
		font-size: 0.9rem;
		color: var(--marquee-dim);
	}

	.badge {
		justify-self: end;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		border: 1px solid var(--panel-border, var(--marquee-dim));
		color: var(--marquee-dim);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.badge.public {
		border-color: transparent;
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		color: var(--cyan);
	}

	@media (max-width: 700px) {
		li {
			grid-template-columns: 1fr;
		}

		.badge {
			justify-self: start;
		}
	}
</style>
