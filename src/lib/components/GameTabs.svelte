<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { gameId }: { gameId: string } = $props();

	const tabs = $derived([
		{
			href: resolve('/admin/games/[id]', { id: gameId }),
			label: 'Körök és kérdések',
			tour: 'tab-rounds'
		},
		{
			href: resolve('/admin/games/[id]/event', { id: gameId }),
			label: 'Esemény és jelentkezések',
			tour: 'tab-event'
		},
		{
			href: resolve('/admin/games/[id]/results', { id: gameId }),
			label: 'Eredmények',
			tour: 'tab-results'
		}
	]);
</script>

<nav class="tabs" aria-label="Kvízeste nézetek">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			data-tour={tab.tour}
			class:active={page.url.pathname === tab.href}
			aria-current={page.url.pathname === tab.href ? 'page' : undefined}>{tab.label}</a
		>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		gap: 1.75rem;
		margin: 1rem 0 1.5rem;
		border-bottom: 1px solid var(--panel-border, var(--cabinet-3));
		overflow-x: auto;
	}

	a {
		padding: 0.75rem 0;
		border-bottom: 2px solid transparent;
		color: var(--marquee-dim);
		font-size: 0.95rem;
		text-decoration: none;
		white-space: nowrap;
	}

	a:hover {
		color: var(--marquee);
	}

	a.active {
		border-bottom-color: var(--cyan);
		color: var(--marquee);
		font-weight: 600;
	}
</style>
