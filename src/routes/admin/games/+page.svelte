<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import DeleteGameButton from '$lib/components/DeleteGameButton.svelte';
	import { withToast } from '$lib/toast-enhance';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { formatEventDate } from '$lib/datetime';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newTitle = $state('');
	let creating = $state(false);
	let reopeningId = $state<string | null>(null);
	let creatingPractice = $state(false);

	registerPageTour(() => 'games');

	// Kvízestét csak rendszergazda (role_id = 1) törölhet.
	const isSuperAdmin = $derived(data.profile?.role_id === 1);

	const firstFinishedId = $derived(data.games.find((g) => g.status === 'finished')?.id);

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

<div class="create-row">
	<form
		data-tour="games-create"
		method="POST"
		action="?/create"
		use:enhance={withToast({ setSubmitting: (v) => (creating = v) })}
	>
		<Input name="title" placeholder="Új kvízeste neve" bind:value={newTitle} required />
		<Button type="submit" loading={creating}>Létrehozás</Button>
	</form>

	<form
		data-tour="games-practice"
		method="POST"
		action="?/createPractice"
		use:enhance={withToast({ setSubmitting: (v) => (creatingPractice = v) })}
	>
		<Button type="submit" variant="secondary" loading={creatingPractice}
			>Próbaeste létrehozása</Button
		>
	</form>
</div>

<ul class="games-grid" data-tour="games-list">
	{#each data.games as game, i (game.id)}
		<li>
			<ArcadePanel>
				<div class="game-card">
					<div class="game-card-header">
						<a href={resolve('/admin/games/[id]', { id: game.id })} class="game-title"
							>{game.title}</a
						>
						<span
							class="badge status-{game.status}"
							data-tour={i === 0 ? 'games-status' : undefined}
							>{STATUS_LABELS[game.status] ?? game.status}</span
						>
						{#if game.is_practice}<span class="badge practice">Próba</span>{/if}
					</div>
					<div class="game-card-meta">
						<span>{game.scheduled_at ? formatEventDate(game.scheduled_at) : 'Nincs időpont'}</span>
						{#if game.venues?.name}<span>{game.venues.name}</span>{/if}
					</div>
					<div class="game-card-meta">
						{#if game.status === 'lobby' && !game.is_practice}
							<a href={resolve('/admin/games/[id]/event', { id: game.id })}>
								{game.confirmedPlayers}{game.max_players ? ` / ${game.max_players}` : ''} fő jelentkezett{game.waitlistTeams
									? ` · ${game.waitlistTeams} várólistán`
									: ''}
							</a>
							{#if game.is_public}<span class="badge public">Nyilvános</span>{/if}
						{:else}
							<span>{teamCount(game)} csapat játszott</span>
						{/if}
						<span class="pin">PIN: {game.pin}</span>
					</div>
					{#if game.status === 'finished'}
						<form
							data-tour={game.id === firstFinishedId ? 'games-reopen' : undefined}
							method="POST"
							action="?/reopen"
							use:enhance={withToast({
								successMessage: 'Kvízeste újranyitva — a Váró állapotból indítható újra.',
								setSubmitting: (v) => (reopeningId = v ? game.id : null)
							})}
						>
							<input type="hidden" name="game_id" value={game.id} />
							<Button type="submit" variant="ghost" loading={reopeningId === game.id}
								>Kvízeste újranyitása</Button
							>
						</form>
					{/if}
					{#if isSuperAdmin}
						<div class="delete-row" data-tour={i === 0 ? 'games-delete' : undefined}>
							<DeleteGameButton
								gameId={game.id}
								title={game.title}
								running={game.status === 'active' || game.status === 'paused'}
							/>
						</div>
					{/if}
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
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	form {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.create-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
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
		color: var(--marquee);
		font-size: 1.1rem;
		font-weight: 600;
		text-decoration: none;
	}

	.game-title:hover {
		text-decoration: underline;
	}

	.game-card-meta a {
		color: var(--cyan);
	}

	.badge.public {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		color: var(--cyan);
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
		color: var(--marquee-dim);
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.status-lobby {
		background: var(--cyan);
		color: var(--on-primary, var(--cabinet));
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

	.delete-row {
		display: flex;
		justify-content: flex-end;
	}

	.empty {
		color: var(--marquee-dim);
	}

	.error {
		color: var(--danger);
	}

	.badge.practice {
		color: var(--magenta);
		border-color: var(--magenta);
	}
</style>
