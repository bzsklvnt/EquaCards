<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newTitle = $state('');
	let creating = $state(false);

	const STATUS_LABELS: Record<string, string> = {
		lobby: 'Váró',
		active: 'Aktív',
		paused: 'Szüneteltetve',
		finished: 'Lezárva'
	};

	function teamCount(game: (typeof data.games)[number]): number {
		return game.teams?.[0]?.count ?? 0;
	}
</script>

<svelte:head>
	<title>Kvízesték — Kezelőfelület</title>
</svelte:head>

<h1>Kvízesték</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form
	method="POST"
	action="?/create"
	use:enhance={withToast({ setSubmitting: (v) => (creating = v) })}
>
	<Input name="title" placeholder="Új kvízeste neve" bind:value={newTitle} required />
	<Button type="submit" loading={creating}>Létrehozás</Button>
</form>

<ul class="games-grid">
	{#each data.games as game (game.id)}
		<li>
			<ArcadePanel>
				<div class="game-card">
					<div class="game-card-header">
						<a href={resolve('/admin/games/[id]', { id: game.id })} class="game-title"
							>{game.title}</a
						>
						<span class="badge status-{game.status}"
							>{STATUS_LABELS[game.status] ?? game.status}</span
						>
					</div>
					<div class="game-card-meta">
						<span class="pin">PIN: {game.pin}</span>
						<span>{teamCount(game)} csapat</span>
						{#if game.status === 'finished' && game.finished_at}
							<span>{new Date(game.finished_at).toLocaleDateString('hu-HU')}</span>
						{/if}
					</div>
				</div>
			</ArcadePanel>
		</li>
	{:else}
		<li class="empty">Még nincs kvízeste.</li>
	{/each}
</ul>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	form {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.games-grid {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.game-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.game-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.game-title {
		color: var(--cyan);
		font-weight: 600;
	}

	.game-card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	.pin {
		font-family: var(--font-led);
		color: var(--coin);
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.status-lobby {
		background: var(--cyan);
		color: var(--cabinet);
	}

	.status-active {
		background: var(--power);
		color: var(--cabinet);
	}

	.status-paused {
		background: var(--coin);
		color: var(--cabinet);
	}

	.status-finished {
		background: var(--cabinet-3);
		color: var(--marquee-dim);
	}

	.empty {
		color: var(--marquee-dim);
	}

	.error {
		color: var(--danger);
	}
</style>
