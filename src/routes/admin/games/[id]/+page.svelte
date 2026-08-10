<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newRoundTitle = $state('');

	// Fázis O6 — a téma-választás este-szintű (egyszer választod ki, minden
	// kör ugyanabból húz), a darabszám marad körönkénti — lásd a
	// ?/drawAll action jegyzetét a +page.server.ts-ben.
	//
	// Fázis Q1 — élő tesztelésből: a témaválasztó üresen ("— válassz témát —")
	// indult, ami inaktívnak/működésképtelennek TŰNT, holott funkcionális
	// volt — csak a placeholder-állapot nem adott vizuális visszajelzést,
	// hogy tényleg egy élő, kattintható legördülőről van szó. Az első
	// elérhető témát automatikusan kiválasztjuk alapértelmezettként (csak
	// egyszer, amíg a felhasználó nem választott sajátot).
	let globalThemeId = $state('');
	$effect(() => {
		if (!globalThemeId && data.themes.length > 0) {
			globalThemeId = data.themes[0].id;
		}
	});
	let roundCounts = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(data.rounds.map((r) => [r.id, '8'])))
	);
	// Új kör felvételekor (?/addRound) a data.rounds bővül, de a roundCounts
	// csak a komponens indulásakor lett feltöltve — ez pótolja az azóta
	// felvett körök hiányzó alapértékét.
	$effect(() => {
		for (const round of data.rounds) {
			if (!(round.id in roundCounts)) {
				roundCounts[round.id] = '8';
			}
		}
	});
	const roundsJson = $derived(
		JSON.stringify(
			data.rounds.map((r) => ({
				round_id: r.id,
				title: r.title,
				count: Number(roundCounts[r.id] ?? 8)
			}))
		)
	);

	let addingRound = $state(false);
	let deletingRoundId = $state<string | null>(null);
	let drawingAll = $state(false);
	let removingKey = $state<string | null>(null);
</script>

<svelte:head>
	<title>{data.game.title} — Kezelőfelület</title>
</svelte:head>

<h1>{data.game.title}</h1>
<p class="status">Állapot: {data.game.status}</p>
<div class="actions">
	<Button href={resolve('/host/[game_id]', { game_id: data.game.id })}
		>Élő lebonyolítás megnyitása →</Button
	>
	<Button variant="ghost" href={resolve('/admin/games/[id]/results', { id: data.game.id })}
		>Részletes eredmények →</Button
	>
</div>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form
	method="POST"
	action="?/addRound"
	use:enhance={withToast({
		successMessage: 'Kör hozzáadva.',
		setSubmitting: (v) => (addingRound = v),
		onSuccess: () => (newRoundTitle = '')
	})}
	class="add-round"
>
	<Input name="title" placeholder="Új kör neve" bind:value={newRoundTitle} required />
	<Button type="submit" loading={addingRound}>+ Kör hozzáadása</Button>
</form>

{#if data.rounds.length > 0}
	<form
		method="POST"
		action="?/drawAll"
		use:enhance={withToast({
			successMessage: 'Kérdések betöltve minden körbe.',
			setSubmitting: (v) => (drawingAll = v)
		})}
		class="draw-all-form"
	>
		<Select label="Téma (minden körhöz)" name="theme_id" bind:value={globalThemeId} required>
			<option value="">— válassz témát —</option>
			{#each data.themes as theme (theme.id)}
				<option value={theme.id}>{theme.title}</option>
			{/each}
		</Select>
		<input type="hidden" name="rounds_json" value={roundsJson} />
		<Button type="submit" loading={drawingAll}>Kérdések betöltése minden körbe</Button>
	</form>
{/if}

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

		<div class="round-count">
			<Input label="Darabszám" type="number" bind:value={roundCounts[round.id]} min="1" max="20" />
		</div>

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

	.status {
		color: var(--marquee-dim);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.75rem 0 1.5rem;
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

	.draw-all-form {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
		background: var(--cabinet-2);
		border: 2px solid var(--violet);
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.round-count {
		max-width: 10rem;
		margin: 0.75rem 0;
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
