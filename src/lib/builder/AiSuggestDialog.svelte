<script lang="ts">
	import { resolve } from '$app/paths';
	import { TYPE_SHORT } from './model';
	import type { Difficulty, SuggestedQuestion, SuggestType } from './ai';

	// AI kérdésjavaslat (docs/features/ai-assistant.md): a kontextus csak az
	// aktuális kvízeste körei és kérdései. A javaslatok előnézetként jönnek;
	// csak a kijelöltek kerülnek a körbe (és így a kérdésbankba), utána a
	// szerkesztőben ugyanúgy javíthatók, mint bármelyik kérdés.
	let {
		open = $bindable(false),
		gameId,
		rounds,
		defaultRoundId,
		enabled,
		onaccept
	}: {
		open?: boolean;
		gameId: string;
		rounds: { id: string; label: string; count: number }[];
		defaultRoundId: string | null;
		/** Van-e API-kulcs a szerveren (ANTHROPIC_API_KEY). */
		enabled: boolean;
		onaccept: (roundId: string, questions: SuggestedQuestion[]) => void;
	} = $props();

	const TYPES: { value: SuggestType; label: string }[] = [
		{ value: 'mixed', label: 'Vegyes' },
		{ value: 'single_choice', label: 'Egy helyes' },
		{ value: 'multi_choice', label: 'Több helyes' },
		{ value: 'true_false', label: 'Igaz / hamis' },
		{ value: 'slider', label: 'Csúszka' }
	];
	const LEVELS: { value: Difficulty; label: string }[] = [
		{ value: 'easy', label: 'Könnyű' },
		{ value: 'medium', label: 'Közepes' },
		{ value: 'hard', label: 'Nehéz' }
	];
	const COUNTS = [3, 5, 8, 10];

	let dialog = $state<HTMLDialogElement>();
	let targetRound = $state<string | null>(null);
	let count = $state(5);
	let type = $state<SuggestType>('mixed');
	let difficulty = $state<Difficulty>('medium');
	let note = $state('');
	let loading = $state(false);
	let failure = $state('');
	let suggestions = $state<SuggestedQuestion[]>([]);
	let picked = $state<boolean[]>([]);

	const pickedCount = $derived(picked.filter(Boolean).length);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			targetRound = defaultRoundId ?? rounds[0]?.id ?? null;
			failure = '';
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	});

	async function ask() {
		if (!targetRound || loading) return;
		loading = true;
		failure = '';
		try {
			const res = await fetch(resolve('/admin/games/[id]/ai', { id: gameId }), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					op: 'suggest',
					round_id: targetRound,
					count,
					type,
					difficulty,
					note
				})
			});
			const payload = (await res.json().catch(() => ({}))) as {
				suggestions?: SuggestedQuestion[];
				error?: string;
				message?: string;
			};
			if (!res.ok || !payload.suggestions) {
				throw new Error(payload.error ?? payload.message ?? 'Nem sikerült javaslatot kérni.');
			}
			suggestions = payload.suggestions;
			picked = suggestions.map(() => true);
		} catch (err) {
			failure = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function discard(i: number) {
		suggestions = suggestions.filter((_, j) => j !== i);
		picked = picked.filter((_, j) => j !== i);
	}

	function accept() {
		if (!targetRound) return;
		const chosen = suggestions.filter((_, i) => picked[i]);
		if (chosen.length === 0) return;
		onaccept(targetRound, chosen);
		suggestions = suggestions.filter((_, i) => !picked[i]);
		picked = suggestions.map(() => true);
		if (suggestions.length === 0) open = false;
	}

	const LETTERS = 'ABCDEFGH';
</script>

<dialog bind:this={dialog} class="drawer" aria-labelledby="ai-title" onclose={() => (open = false)}>
	<header>
		<div class="title-row">
			<div>
				<h2 id="ai-title">AI kérdésjavaslat</h2>
				<p class="dim">
					Csak ennek a kvízestnek a köreit és kérdéseit látja: azok témájához és stílusához
					igazodik, és nem ismétli őket.
				</p>
			</div>
			<button type="button" class="ghost" onclick={() => (open = false)}>Bezárás · Esc</button>
		</div>
		{#if !enabled}
			<p class="warn" role="alert">
				Az AI nincs bekapcsolva: a szerveren hiányzik az <code>ANTHROPIC_API_KEY</code> környezeti változó
				(Vercel › Settings › Environment Variables).
			</p>
		{/if}
		<div class="target">
			<span class="target-label" id="ai-target">Hová kerül?</span>
			<div class="rounds" role="radiogroup" aria-labelledby="ai-target">
				{#each rounds as round (round.id)}
					<button
						type="button"
						role="radio"
						aria-checked={targetRound === round.id}
						class:on={targetRound === round.id}
						onclick={() => (targetRound = round.id)}
						><span class="radio" aria-hidden="true"></span>{round.label}<small
							>{round.count} kérdés</small
						></button
					>
				{/each}
			</div>
		</div>
		<form
			class="request"
			onsubmit={(e) => {
				e.preventDefault();
				void ask();
			}}
		>
			<label>
				<span>Darab</span>
				<select bind:value={count}>
					{#each COUNTS as n (n)}<option value={n}>{n}</option>{/each}
				</select>
			</label>
			<label>
				<span>Típus</span>
				<select bind:value={type}>
					{#each TYPES as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
				</select>
			</label>
			<label>
				<span>Nehézség</span>
				<select bind:value={difficulty}>
					{#each LEVELS as l (l.value)}<option value={l.value}>{l.label}</option>{/each}
				</select>
			</label>
			<label class="note">
				<span>Külön kérés (nem kötelező)</span>
				<input
					bind:value={note}
					maxlength="500"
					placeholder="pl. több sport, kevesebb évszám"
					autocomplete="off"
				/>
			</label>
			<button type="submit" class="primary" disabled={!enabled || !targetRound || loading}
				>{loading
					? 'Gondolkodik…'
					: suggestions.length
						? 'Újabb javaslatok'
						: 'Javaslatok kérése'}</button
			>
		</form>
	</header>

	<div class="results" aria-live="polite" aria-busy={loading}>
		{#if failure}
			<p class="warn" role="alert">{failure}</p>
		{/if}
		{#if loading}
			<p class="dim center">Az AI a kör kérdései alapján dolgozik — ez 10–40 másodperc is lehet.</p>
		{:else if suggestions.length === 0}
			<p class="dim center">
				Válaszd ki a kört és a beállításokat, majd kérj javaslatokat. Semmi nem kerül a körbe, amíg
				el nem fogadod.
			</p>
		{:else}
			<ol class="cards">
				{#each suggestions as s, i (i)}
					<li class:off={!picked[i]}>
						<label class="pick">
							<input type="checkbox" bind:checked={picked[i]} />
							<span class="sr-only">Kijelölés</span>
						</label>
						<div class="body">
							<span class="type">{TYPE_SHORT[s.type] ?? s.type}</span>
							<p class="prompt">{s.prompt}</p>
							{#if s.options}
								<ul class="options">
									{#each s.options as o, j (j)}
										<li class:correct={o.correct}>
											<b>{LETTERS[j]}</b>
											{o.text}{#if o.correct}<span class="tick" aria-label="helyes"> ✓</span>{/if}
										</li>
									{/each}
								</ul>
							{:else if s.slider}
								<p class="slider">
									{s.slider.min}–{s.slider.max} · helyes: <b>{s.slider.correct}</b>
									{s.slider.tolerance ? `± ${s.slider.tolerance}` : ''}
								</p>
							{/if}
							{#if s.note}<p class="why">{s.note}</p>{/if}
						</div>
						<button
							type="button"
							class="icon"
							title="Elvetés"
							aria-label="Javaslat elvetése"
							onclick={() => discard(i)}>✕</button
						>
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	{#if suggestions.length > 0}
		<footer>
			<span class="dim"
				>Ellenőrizd a tényeket! A hozzáadott kérdések a szerkesztőben tovább javíthatók.</span
			>
			<button type="button" class="primary" disabled={pickedCount === 0} onclick={accept}
				>{pickedCount} kérdés hozzáadása</button
			>
		</footer>
	{/if}
</dialog>

<style>
	.drawer {
		position: fixed;
		inset: 0 0 0 auto;
		width: min(48rem, 100vw);
		height: 100dvh;
		max-height: 100dvh;
		max-width: 100vw;
		margin: 0;
		padding: 0;
		border: 0;
		display: none;
		flex-direction: column;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: -18px 0 40px rgb(28 27 24 / 18%);
	}

	.drawer[open] {
		display: flex;
	}

	.drawer::backdrop {
		background: rgb(28 27 24 / 30%);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.2rem 1.5rem 0.9rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.6rem;
	}

	.dim {
		margin: 0.25rem 0 0;
		color: var(--marquee-dim);
		font-size: 0.88rem;
	}

	.center {
		margin: 2rem auto;
		max-width: 30rem;
		text-align: center;
	}

	.warn {
		margin: 0;
		padding: 0.6rem 0.8rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--danger, #a3261e) 10%, var(--cabinet-2));
		color: var(--danger, #a3261e);
		font-size: 0.88rem;
	}

	.target {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.75rem;
		background: var(--cabinet);
	}

	.target-label,
	label span {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.rounds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.rounds button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.3rem;
		padding: 0 0.8rem 0 0.6rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 999px;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-size: 0.88rem;
	}

	.rounds button small {
		color: var(--marquee-dim);
		font-size: 0.75rem;
	}

	.radio {
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
		border: 2px solid var(--field-border, #c9bfa9);
		border-radius: 50%;
		box-sizing: border-box;
	}

	.rounds button.on {
		border: 2px solid var(--cyan);
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		font-weight: 700;
	}

	.rounds button.on .radio {
		border: 4px solid var(--cyan);
	}

	.request {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem;
	}

	.request label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.request .note {
		flex: 1 1 14rem;
	}

	select,
	input {
		min-height: 2.5rem;
		padding: 0 0.6rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		background: var(--cabinet);
		color: var(--marquee);
		font: inherit;
	}

	.results {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 1rem 1.5rem;
	}

	.cards {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
	}

	.cards > li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.75rem;
		background: var(--cabinet);
	}

	.cards > li.off {
		opacity: 0.55;
	}

	.pick input {
		width: 1.15rem;
		height: 1.15rem;
		min-height: 0;
		margin-top: 0.2rem;
		accent-color: var(--cyan);
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.type {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.prompt {
		margin: 0.2rem 0 0.5rem;
		font-weight: 600;
	}

	.options {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.3rem 1rem;
		margin: 0;
		padding: 0;
		font-size: 0.9rem;
	}

	.options b {
		display: inline-block;
		width: 1.2rem;
		color: var(--marquee-dim);
	}

	.options .correct {
		color: var(--power, #1e7a4f);
		font-weight: 700;
	}

	.slider {
		margin: 0;
		font-size: 0.9rem;
	}

	.why {
		margin: 0.5rem 0 0;
		color: var(--marquee-dim);
		font-size: 0.82rem;
		font-style: italic;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1.5rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.ghost,
	.primary {
		min-height: 2.5rem;
		padding: 0 0.9rem;
		border-radius: 0.55rem;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.ghost {
		border: 1px solid var(--field-border, #d5cec0);
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.primary {
		border: 0;
		background: var(--btn-primary, var(--cyan));
		color: var(--on-primary, #fff);
	}

	.icon {
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 0.4rem;
		background: none;
		color: var(--marquee-dim);
	}

	.icon:hover {
		background: var(--cabinet-2);
		color: var(--danger, #a3261e);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	@media (max-width: 640px) {
		header,
		.results,
		footer {
			padding-left: 1rem;
			padding-right: 1rem;
		}

		.options {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
