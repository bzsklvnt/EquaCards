<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	// Egy kvízeste munkaterületének közös fejléce (Esemény, Eredmények) —
	// ugyanaz a sáv, mint a kvízösszerakóé. docs/features/admin-workspace.md.
	let {
		game,
		active,
		status,
		actions
	}: {
		game: { id: string; title: string };
		active: 'event' | 'results';
		status?: Snippet;
		actions?: Snippet;
	} = $props();

	const tabs = $derived([
		{ key: 'editor', label: 'Szerkesztő', href: resolve('/admin/games/[id]', { id: game.id }) },
		{
			key: 'overview',
			label: 'Áttekintés',
			href: `${resolve('/admin/games/[id]', { id: game.id })}?view=overview`
		},
		{
			key: 'event',
			label: 'Esemény',
			href: resolve('/admin/games/[id]/event', { id: game.id }),
			tour: 'tab-event'
		},
		{
			key: 'results',
			label: 'Eredmények',
			href: resolve('/admin/games/[id]/results', { id: game.id }),
			tour: 'tab-results'
		}
	]);
</script>

<header class="game-header">
	<a class="back" href={resolve('/admin/games')}>← Kvízesték</a>
	<div class="title">
		<h1>{game.title}</h1>
		{#if status}{@render status()}{/if}
	</div>
	<nav class="views" aria-label="Kvízeste nézetek" data-tour="tab-rounds">
		{#each tabs as tab (tab.key)}
			<a
				href={tab.href}
				class:active={tab.key === active}
				aria-current={tab.key === active ? 'page' : undefined}
				data-tour={tab.tour}>{tab.label}</a
			>
		{/each}
	</nav>
	<div class="actions">
		{#if actions}{@render actions()}{/if}
		<a class="ws-btn primary" href={resolve('/host/[game_id]', { game_id: game.id })}
			>Élő lebonyolítás →</a
		>
	</div>
</header>

<style>
	.game-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.1rem;
		min-height: 4rem;
		box-sizing: border-box;
		padding: 0.5rem 1.2rem;
		background: var(--cabinet-2);
		border-bottom: 1px solid var(--panel-border, #e4ded2);
	}

	.back {
		color: var(--marquee-dim);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.35rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 22rem;
	}

	.views {
		display: flex;
		padding: 4px;
		margin: 0 auto;
		border-radius: 0.65rem;
		background: var(--cabinet);
		font-size: 0.9rem;
	}

	.views a {
		padding: 0.45rem 0.85rem;
		border-radius: 0.45rem;
		color: var(--marquee-dim);
		text-decoration: none;
	}

	.views a.active {
		background: var(--cabinet-2);
		color: var(--marquee);
		font-weight: 600;
	}

	.views a:focus-visible,
	.back:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	@media (max-width: 720px) {
		.views {
			margin: 0;
			order: 5;
			width: 100%;
			overflow-x: auto;
		}

		h1 {
			max-width: 12rem;
		}
	}
</style>
