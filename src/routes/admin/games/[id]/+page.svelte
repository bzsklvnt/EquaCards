<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newRoundTitle = $state('');
	let drawThemeId = $state('');
	let drawCount = $state('8');

	let addingRound = $state(false);
	let deletingRoundId = $state<string | null>(null);
	let drawingRoundId = $state<string | null>(null);
	let removingKey = $state<string | null>(null);
</script>

<svelte:head>
	<title>{data.game.title} — Kezelőfelület</title>
</svelte:head>

<h1>{data.game.title}</h1>
<p class="status">Állapot: {data.game.status}</p>
<a href={resolve('/host/[game_id]', { game_id: data.game.id })}>Élő lebonyolítás megnyitása →</a>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form
	method="POST"
	action="?/addRound"
	use:enhance={withToast({ setSubmitting: (v) => (addingRound = v) })}
	class="add-round"
>
	<Input name="title" placeholder="Új kör neve" bind:value={newRoundTitle} required />
	<Button type="submit" loading={addingRound}>+ Kör hozzáadása</Button>
</form>

{#each data.rounds as round (round.id)}
	<section class="round">
		<div class="round-header">
			<h2>{round.order_index}. {round.title}</h2>
			<form
				method="POST"
				action="?/deleteRound"
				use:enhance={withToast({
					successMessage: 'Kör törölve.',
					setSubmitting: (v) => (deletingRoundId = v ? round.id : null)
				})}
			>
				<input type="hidden" name="round_id" value={round.id} />
				<Button type="submit" variant="danger" loading={deletingRoundId === round.id}
					>Kör törlése</Button
				>
			</form>
		</div>

		<form
			method="POST"
			action="?/draw"
			use:enhance={withToast({
				successMessage: 'Kérdések kihúzva.',
				setSubmitting: (v) => (drawingRoundId = v ? round.id : null)
			})}
			class="draw-form"
		>
			<input type="hidden" name="round_id" value={round.id} />
			<Select label="Téma" name="theme_id" bind:value={drawThemeId} required>
				<option value="">— válassz témát —</option>
				{#each data.themes as theme (theme.id)}
					<option value={theme.id}>{theme.title}</option>
				{/each}
			</Select>
			<Input label="Darabszám" type="number" name="count" bind:value={drawCount} min="1" max="20" />
			<Button type="submit" loading={drawingRoundId === round.id}>Random húzás</Button>
		</form>

		<ol>
			{#each data.roundQuestions[round.id] ?? [] as rq (rq.question_id)}
				<li>
					{rq.prompt}
					<form
						method="POST"
						action="?/removeQuestion"
						use:enhance={withToast({
							setSubmitting: (v) => (removingKey = v ? `${round.id}:${rq.question_id}` : null)
						})}
					>
						<input type="hidden" name="round_id" value={round.id} />
						<input type="hidden" name="question_id" value={rq.question_id} />
						<Button
							type="submit"
							variant="ghost"
							loading={removingKey === `${round.id}:${rq.question_id}`}>Eltávolítás</Button
						>
					</form>
				</li>
			{:else}
				<li class="empty">Még nincs kérdés ebben a körben.</li>
			{/each}
		</ol>
	</section>
{:else}
	<p>Még nincs kör felvéve.</p>
{/each}

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	h2 {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--marquee);
	}

	a {
		color: var(--cyan);
	}

	.status {
		color: var(--marquee-dim);
	}

	.add-round {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.5rem;
		margin: 1rem 0 1.5rem;
	}

	.round {
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.round-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.draw-form {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin: 1rem 0;
	}

	ol {
		padding-left: 1.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.25rem;
		color: var(--marquee);
	}

	li form {
		display: inline;
	}

	.empty {
		color: var(--marquee-dim);
		list-style: none;
		margin-left: -1.5rem;
	}

	.error {
		color: var(--danger);
	}
</style>
