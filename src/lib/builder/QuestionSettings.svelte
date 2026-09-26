<script lang="ts">
	import {
		convertDraft,
		MAX_TIME_LIMIT,
		MIN_TIME_LIMIT,
		TIME_PRESETS,
		TYPE_ORDER,
		TYPE_SHORT,
		type Draft,
		type QuestionTypeInfo
	} from './model';

	// A kérdés beállításai (jobb oldali panel): típus, válaszidő (gyors
	// választók + egyéni mező), olvasási idő (alap / egyéni), pontozás, téma.
	let {
		draft = $bindable(),
		types,
		themes,
		readingDefault,
		showStandings,
		onstandingschange,
		onduplicate,
		onremove,
		removeLabel = 'Eltávolítás a körből'
	}: {
		draft: Draft;
		types: QuestionTypeInfo[];
		themes: { id: string; title: string }[];
		readingDefault: number;
		/** Csak a kvízösszerakóban (a kérdés a körben elfoglalt helyéhez tartozik). */
		showStandings?: boolean;
		onstandingschange?: (value: boolean) => void;
		onduplicate?: () => void;
		onremove?: () => void;
		removeLabel?: string;
	} = $props();

	const orderedTypes = $derived(
		[...types].sort((a, b) => TYPE_ORDER.indexOf(a.code) - TYPE_ORDER.indexOf(b.code))
	);

	function setType(type: QuestionTypeInfo) {
		if (type.code === draft.type_code) return;
		draft = convertDraft(draft, type);
	}

	const isPreset = $derived(TIME_PRESETS.includes(draft.time_limit_seconds));
	// A mező a nem-gyors értéket mutatja (pl. 25), gyors választásnál üres.
	let customTime = $derived(isPreset ? '' : String(draft.time_limit_seconds));

	function onCustomTime(value: string) {
		customTime = value;
		const n = Number.parseInt(value, 10);
		if (Number.isFinite(n)) draft.time_limit_seconds = n;
	}

	const readingCustom = $derived(draft.reading_seconds !== null);
</script>

<div class="settings">
	<section data-tour="qb-type">
		<h3>Kérdéstípus <kbd>T</kbd></h3>
		<div class="type-grid" role="radiogroup" aria-label="Kérdéstípus">
			{#each orderedTypes as t (t.id)}
				<button
					type="button"
					role="radio"
					aria-checked={draft.type_code === t.code}
					class:active={draft.type_code === t.code}
					title={t.label}
					onclick={() => setType(t)}>{TYPE_SHORT[t.code] ?? t.label}</button
				>
			{/each}
		</div>
	</section>

	<section data-tour="qb-time">
		<h3>Válaszidő</h3>
		<div class="chips" role="radiogroup" aria-label="Válaszidő (mp)">
			{#each TIME_PRESETS as preset (preset)}
				<button
					type="button"
					role="radio"
					aria-checked={draft.time_limit_seconds === preset}
					class:active={draft.time_limit_seconds === preset}
					onclick={() => (draft.time_limit_seconds = preset)}>{preset}</button
				>
			{/each}
		</div>
		<label class="inline">
			<span>Egyéni</span>
			<input
				type="number"
				inputmode="numeric"
				min={MIN_TIME_LIMIT}
				max={MAX_TIME_LIMIT}
				placeholder="pl. 25"
				value={customTime}
				oninput={(e) => onCustomTime(e.currentTarget.value)}
				class:active={!isPreset}
			/>
			<span class="dim">mp · {MIN_TIME_LIMIT}–{MAX_TIME_LIMIT}</span>
		</label>

		<h3 class="sub">Olvasási idő a válasz előtt</h3>
		<div class="inline">
			<div class="segmented" role="radiogroup" aria-label="Olvasási idő">
				<button
					type="button"
					role="radio"
					aria-checked={!readingCustom}
					class:active={!readingCustom}
					onclick={() => (draft.reading_seconds = null)}>Alap · {readingDefault} mp</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={readingCustom}
					class:active={readingCustom}
					onclick={() => (draft.reading_seconds = draft.reading_seconds ?? readingDefault)}
					>Egyéni</button
				>
			</div>
			{#if readingCustom}
				<input
					type="number"
					inputmode="numeric"
					min="0"
					max="120"
					aria-label="Olvasási idő (mp)"
					value={draft.reading_seconds ?? ''}
					oninput={(e) => {
						const n = Number.parseInt(e.currentTarget.value, 10);
						draft.reading_seconds = Number.isFinite(n) ? n : 0;
					}}
				/>
				<span class="dim">mp</span>
			{/if}
		</div>
	</section>

	<section data-tour="qb-scoring">
		<h3>Pontozás</h3>
		<div class="inline">
			<label class="stack">
				<span class="dim">Pont</span>
				<input type="number" min="0" step="50" bind:value={draft.points} />
			</label>
			<div class="segmented" role="radiogroup" aria-label="Szorzó">
				<button
					type="button"
					role="radio"
					aria-checked={draft.points_multiplier === 1}
					class:active={draft.points_multiplier === 1}
					onclick={() => (draft.points_multiplier = 1)}>Normál</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={draft.points_multiplier === 2}
					class:active={draft.points_multiplier === 2}
					onclick={() => (draft.points_multiplier = 2)}>Dupla</button
				>
			</div>
		</div>
		<label class="toggle">
			<span>Gyorsasági pontcsökkenés</span>
			<input type="checkbox" bind:checked={draft.points_decay} />
		</label>
		{#if showStandings !== undefined}
			<label class="toggle" data-tour="qb-standings">
				<span>Állás a kérdés után (kivetítő)</span>
				<input
					type="checkbox"
					checked={showStandings}
					onchange={(e) => onstandingschange?.(e.currentTarget.checked)}
				/>
			</label>
		{/if}
		<label class="toggle" class:disabled={!draft.image_url}>
			<span>Pixeles képfelfedés{draft.image_url ? '' : ' (nincs kép)'}</span>
			<input type="checkbox" disabled={!draft.image_url} bind:checked={draft.image_pixelate} />
		</label>
	</section>

	<section>
		<label class="stack">
			<h3>Téma</h3>
			<select
				value={draft.theme_id ?? ''}
				onchange={(e) => (draft.theme_id = e.currentTarget.value || null)}
			>
				<option value="">— nincs téma —</option>
				{#each themes as theme (theme.id)}
					<option value={theme.id}>{theme.title}</option>
				{/each}
			</select>
		</label>
	</section>

	{#if onduplicate || onremove}
		<div class="actions">
			{#if onduplicate}
				<button type="button" onclick={onduplicate}>Duplikálás <kbd>Ctrl D</kbd></button>
			{/if}
			{#if onremove}
				<button type="button" class="danger" onclick={onremove}>{removeLabel} <kbd>Del</kbd></button
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		font-size: 0.9rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	h3.sub {
		margin-top: 0.5rem;
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		letter-spacing: 0;
		color: var(--marquee-dim);
	}

	.type-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.type-grid button,
	.actions button {
		min-height: 2.5rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.type-grid button.active {
		border: 2px solid var(--cyan);
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		font-weight: 700;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.chips button {
		min-width: 2.6rem;
		height: 2.2rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 999px;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.chips button.active {
		border-color: var(--cyan);
		background: var(--cyan);
		color: var(--on-primary, #fff);
		font-weight: 700;
	}

	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.dim {
		color: var(--marquee-dim);
	}

	input[type='number'],
	select {
		height: 2.3rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.55rem;
		font: inherit;
		color: var(--marquee);
		background: var(--cabinet-2);
	}

	input[type='number'] {
		width: 5.2rem;
	}

	input.active {
		border: 2px solid var(--cyan);
	}

	input:focus-visible,
	select:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.segmented {
		display: inline-flex;
		padding: 3px;
		border-radius: 0.6rem;
		background: var(--cabinet);
	}

	.segmented button {
		height: 2rem;
		padding: 0 0.7rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--marquee-dim);
	}

	.segmented button.active {
		background: var(--cabinet-2);
		color: var(--marquee);
		font-weight: 700;
		box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
	}

	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 2rem;
		cursor: pointer;
	}

	.toggle.disabled {
		color: var(--marquee-dim);
		cursor: default;
	}

	.toggle input {
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--cyan);
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-top: auto;
	}

	.actions .danger {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 35%, var(--cabinet-2));
	}
</style>
