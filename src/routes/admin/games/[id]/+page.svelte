<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newRoundTitle = $state('');

	// Fázis O6 — a téma-választás este-szintű (egyszer választod ki, minden
	// kör ugyanabból húz), a darabszám marad körönkénti — lásd a
	// ?/drawAll action jegyzetét a +page.server.ts-ben.
	//
	// Fázis Q1 — az első elérhető témát automatikusan kiválasztjuk
	// alapértelmezettként (csak egyszer, amíg a felhasználó nem választott
	// sajátot).
	let globalThemeId = $state('');
	$effect(() => {
		if (!globalThemeId && data.themes.length > 0) {
			globalThemeId = data.themes[0].id;
		}
	});

	// Élő tesztből: új kör felvétele után a kör NEM jelent meg (csak a
	// téma-választó), amíg nem töltöttük újra az oldalt. Gyökérok: a
	// korábbi `bind:value={roundCounts[round.id]}` egy frissen érkezett
	// körnél `undefined`-ra kötött (az alapértéket beíró $effect csak a
	// render UTÁN futott), a Svelte 5 pedig `props_invalid_value` hibát
	// dob, ha egy fallback-értékes propot undefined-ra kötünk — ez a hiba
	// megszakította a teljes {#each} renderelést, és utána az oldal
	// minden további frissítése (pl. kérdés-eltávolítás) is elakadt. A
	// függvény-kötés mindig definiált értéket ad vissza.
	let roundCounts = $state<Record<string, string>>({});
	const countFor = (roundId: string) => roundCounts[roundId] ?? '8';

	const roundsJson = $derived(
		JSON.stringify(
			data.rounds.map((r) => ({
				round_id: r.id,
				title: r.title,
				count: Number(countFor(r.id))
			}))
		)
	);

	let addingRound = $state(false);
	let deletingRoundId = $state<string | null>(null);
	let clearingRoundId = $state<string | null>(null);
	let drawingAll = $state(false);
	let removingKey = $state<string | null>(null);

	// Kézi válogatás a kérdésbankból — egyszerre egy kör választója lehet nyitva.
	let pickerRoundId = $state<string | null>(null);
	let pickerThemeId = $state('');
	let pickerSearch = $state('');
	let pickerSelected = $state<string[]>([]);
	let addingQuestions = $state(false);

	function openPicker(roundId: string) {
		if (pickerRoundId === roundId) {
			pickerRoundId = null;
			return;
		}
		pickerRoundId = roundId;
		pickerThemeId = globalThemeId;
		pickerSearch = '';
		pickerSelected = [];
	}

	function togglePicked(id: string) {
		pickerSelected = pickerSelected.includes(id)
			? pickerSelected.filter((x) => x !== id)
			: [...pickerSelected, id];
	}

	const pickerCandidates = $derived.by(() => {
		if (!pickerRoundId) return [];
		const inRound = new Set((data.roundQuestions[pickerRoundId] ?? []).map((q) => q.question_id));
		const needle = pickerSearch.trim().toLowerCase();
		return data.bank.filter(
			(q) =>
				!inRound.has(q.id) &&
				(!pickerThemeId || q.theme_id === pickerThemeId) &&
				(!needle || q.prompt.toLowerCase().includes(needle))
		);
	});

	const newQuestionHref = (roundId: string) =>
		`${resolve('/admin/questions/new')}?round_id=${roundId}${globalThemeId ? `&theme_id=${globalThemeId}` : ''}`;
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
		<Button type="submit" loading={drawingAll}>Random kérdések betöltése minden körbe</Button>
	</form>
{/if}

{#each data.rounds as round (round.id)}
	{@const questions = data.roundQuestions[round.id] ?? []}
	<section class="round">
		<div class="round-header">
			<h2>{round.order_index}. {round.title}</h2>
			<div class="round-header-actions">
				{#if questions.length > 0}
					<form
						method="POST"
						action="?/clearRound"
						use:enhance={withToast({
							successMessage: 'A kör összes kérdése törölve.',
							setSubmitting: (v) => (clearingRoundId = v ? round.id : null)
						})}
					>
						<input type="hidden" name="round_id" value={round.id} />
						<Button type="submit" variant="secondary" loading={clearingRoundId === round.id}
							>Összes kérdés törlése</Button
						>
					</form>
				{/if}
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
		</div>

		<div class="round-count">
			<Input
				label="Darabszám (random húzáshoz)"
				type="number"
				bind:value={() => countFor(round.id), (v) => (roundCounts[round.id] = v)}
				min="1"
				max="20"
			/>
		</div>

		<ol>
			{#each questions as rq (rq.question_id)}
				<li>
					<span class="prompt">{rq.prompt}</span>
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

		<div class="round-add-actions">
			<Button variant="secondary" onclick={() => openPicker(round.id)}>
				{pickerRoundId === round.id ? 'Választó bezárása' : '+ Kérdés a kérdésbankból'}
			</Button>
			<Button variant="ghost" href={newQuestionHref(round.id)}>+ Új kérdés ehhez a körhöz</Button>
		</div>

		{#if pickerRoundId === round.id}
			<form
				method="POST"
				action="?/addQuestions"
				class="picker"
				use:enhance={withToast({
					successMessage: 'Kérdések hozzáadva a körhöz.',
					setSubmitting: (v) => (addingQuestions = v),
					onSuccess: () => (pickerRoundId = null)
				})}
			>
				<input type="hidden" name="round_id" value={round.id} />
				<div class="picker-filters">
					<Select label="Téma" bind:value={pickerThemeId}>
						<option value="">— összes téma —</option>
						{#each data.themes as theme (theme.id)}
							<option value={theme.id}>{theme.title}</option>
						{/each}
					</Select>
					<Input label="Keresés" placeholder="Kérdés szövege…" bind:value={pickerSearch} />
				</div>

				<ul class="picker-list">
					{#each pickerCandidates as q (q.id)}
						<li>
							<Checkbox
								label={q.prompt}
								name="question_id"
								value={q.id}
								checked={pickerSelected.includes(q.id)}
								onchange={() => togglePicked(q.id)}
							/>
							<span class="type-label">{q.type_label}</span>
						</li>
					{:else}
						<li class="empty">Nincs választható kérdés ezzel a szűréssel.</li>
					{/each}
				</ul>

				<Button type="submit" loading={addingQuestions} disabled={pickerSelected.length === 0}
					>Kiválasztottak hozzáadása ({pickerSelected.length})</Button
				>
			</form>
		{/if}
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
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.round-header-actions,
	.round-add-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.round-add-actions {
		margin-top: 0.75rem;
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
		max-width: 14rem;
		margin: 0.75rem 0;
	}

	ol {
		padding-left: 1.5rem;
	}

	ol li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.25rem;
		color: var(--marquee);
	}

	ol li form {
		display: inline;
	}

	.empty {
		color: var(--marquee-dim);
		list-style: none;
	}

	ol .empty {
		margin-left: -1.5rem;
	}

	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
		padding: 1rem;
		border: 2px solid var(--violet);
		border-radius: 0.75rem;
		background: var(--cabinet);
	}

	.picker-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.picker-filters > :global(*) {
		flex: 1;
		min-width: 12rem;
	}

	.picker-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 18rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.picker-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
	}

	.picker-list li:hover {
		background: var(--cabinet-2);
	}

	.type-label {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	.error {
		color: var(--danger);
	}
</style>
