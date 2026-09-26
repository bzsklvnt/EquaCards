<script lang="ts">
	import {
		effectivePreset,
		INFO_PRESETS,
		QUESTION_PRESETS,
		type LayoutPreset,
		type QuestionLayout
	} from '$lib/questions/layout';
	import { isChoiceType, type Draft } from './model';

	// Kérdésenkénti megjelenés (docs/features/question-layout.md): elrendezés,
	// időzítő, kör/kérdésszám, betűméret és a telefonos lapok. A videós
	// kérdés elrendezését a Videó szakasz választja.
	let {
		draft = $bindable(),
		onapplyround
	}: {
		draft: Draft;
		/** Csak a kvízösszerakóban: a beállítások átvitele a kör többi kérdésére. */
		onapplyround?: () => void;
	} = $props();

	const info = $derived(draft.type_code === 'info');
	const presets = $derived(info ? INFO_PRESETS : QUESTION_PRESETS);
	const active = $derived(effectivePreset(draft.layout, { info, video: !!draft.video }));

	function set<K extends keyof QuestionLayout>(key: K, value: QuestionLayout[K]) {
		draft.layout = { ...draft.layout, [key]: value };
	}

	const TIMER: { value: QuestionLayout['timer']; label: string }[] = [
		{ value: 'corner', label: 'Sarokban' },
		{ value: 'below', label: 'Kérdés alatt' },
		{ value: 'big', label: 'Nagyban' }
	];
	const COUNTER: { value: QuestionLayout['counter']; label: string }[] = [
		{ value: 'top', label: 'Fent' },
		{ value: 'bottom', label: 'Lent' },
		{ value: 'hidden', label: 'Rejtve' }
	];
	const SIZE: { value: QuestionLayout['size']; label: string }[] = [
		{ value: 'normal', label: 'Normál' },
		{ value: 'large', label: 'Nagy' },
		{ value: 'xl', label: 'Extra nagy' }
	];
</script>

{#snippet thumb(preset: LayoutPreset)}
	<svg viewBox="0 0 64 36" aria-hidden="true">
		<rect x="0.5" y="0.5" width="63" height="35" rx="3" class="frame" />
		{#if preset === 'classic'}
			<rect x="8" y="5" width="48" height="4" rx="1" class="text" />
			<rect x="22" y="11" width="20" height="10" rx="1" class="img" />
			<rect x="8" y="24" width="23" height="4" rx="1" class="ans" />
			<rect x="33" y="24" width="23" height="4" rx="1" class="ans" />
			<rect x="8" y="30" width="23" height="4" rx="1" class="ans" />
			<rect x="33" y="30" width="23" height="4" rx="1" class="ans" />
		{:else if preset === 'image_left' || preset === 'image_right'}
			{@const imgX = preset === 'image_left' ? 5 : 35}
			{@const txtX = preset === 'image_left' ? 35 : 5}
			<rect x={imgX} y="5" width="24" height="26" rx="1.5" class="img" />
			<rect x={txtX} y="6" width="24" height="4" rx="1" class="text" />
			<rect x={txtX} y="14" width="24" height="4" rx="1" class="ans" />
			<rect x={txtX} y="20" width="24" height="4" rx="1" class="ans" />
			<rect x={txtX} y="26" width="24" height="4" rx="1" class="ans" />
		{:else if preset === 'image_bg'}
			<rect x="1" y="1" width="62" height="34" rx="2.5" class="img" />
			<rect x="10" y="7" width="44" height="5" rx="1" class="text solid" />
			<rect x="8" y="22" width="23" height="4" rx="1" class="ans solid" />
			<rect x="33" y="22" width="23" height="4" rx="1" class="ans solid" />
			<rect x="8" y="28" width="23" height="4" rx="1" class="ans solid" />
			<rect x="33" y="28" width="23" height="4" rx="1" class="ans solid" />
		{:else if preset === 'text'}
			<rect x="6" y="8" width="52" height="6" rx="1" class="text" />
			<rect x="14" y="16" width="36" height="4" rx="1" class="text" />
			<rect x="8" y="26" width="11" height="4" rx="1" class="ans" />
			<rect x="21" y="26" width="11" height="4" rx="1" class="ans" />
			<rect x="34" y="26" width="11" height="4" rx="1" class="ans" />
			<rect x="47" y="26" width="11" height="4" rx="1" class="ans" />
		{:else if preset === 'info_split'}
			<rect x="5" y="5" width="26" height="26" rx="1.5" class="img" />
			<rect x="35" y="7" width="24" height="5" rx="1" class="text" />
			<rect x="35" y="16" width="24" height="2.5" rx="1" class="ans" />
			<rect x="35" y="21" width="20" height="2.5" rx="1" class="ans" />
			<rect x="35" y="26" width="22" height="2.5" rx="1" class="ans" />
		{:else if preset === 'info_image'}
			<rect x="5" y="4" width="54" height="23" rx="1.5" class="img" />
			<rect x="14" y="29" width="36" height="4" rx="1" class="text" />
		{/if}
	</svg>
{/snippet}

<section class="layout" aria-label="Megjelenés">
	<h3>Megjelenés a kivetítőn</h3>
	{#if !draft.video || info}
		<div class="presets" role="radiogroup" aria-label="Elrendezés">
			{#each presets as p (p.value)}
				<button
					type="button"
					role="radio"
					aria-checked={active === p.value}
					class:active={active === p.value}
					onclick={() => set('preset', p.value)}
				>
					{@render thumb(p.value)}
					<span>{p.label}</span>
				</button>
			{/each}
		</div>
		{#if !info && !draft.image_url && active !== 'classic' && active !== 'text'}
			<p class="dim">Kép nélkül ez az elrendezés a „Csak szöveg” szerint jelenik meg.</p>
		{/if}
	{/if}

	{#if !info}
		<span class="label">Időzítő</span>
		<div class="segmented" role="radiogroup" aria-label="Időzítő">
			{#each TIMER as o (o.value)}
				<button
					type="button"
					role="radio"
					aria-checked={draft.layout.timer === o.value}
					class:active={draft.layout.timer === o.value}
					onclick={() => set('timer', o.value)}>{o.label}</button
				>
			{/each}
		</div>
	{/if}

	<span class="label">Kör és kérdésszám</span>
	<div class="segmented" role="radiogroup" aria-label="Kör és kérdésszám">
		{#each COUNTER as o (o.value)}
			<button
				type="button"
				role="radio"
				aria-checked={draft.layout.counter === o.value}
				class:active={draft.layout.counter === o.value}
				onclick={() => set('counter', o.value)}>{o.label}</button
			>
		{/each}
	</div>

	<span class="label">Szövegméret</span>
	<div class="segmented" role="radiogroup" aria-label="Szövegméret">
		{#each SIZE as o (o.value)}
			<button
				type="button"
				role="radio"
				aria-checked={draft.layout.size === o.value}
				class:active={draft.layout.size === o.value}
				onclick={() => set('size', o.value)}>{o.label}</button
			>
		{/each}
	</div>

	{#if !info}
		<h3 class="sub">Telefon</h3>
		{#if isChoiceType(draft.type_code)}
			<div class="inline">
				<span>Válaszlapok</span>
				<div class="segmented" role="radiogroup" aria-label="Válaszlapok oszlopai a telefonon">
					<button
						type="button"
						role="radio"
						aria-checked={draft.layout.phone_cols === 1}
						class:active={draft.layout.phone_cols === 1}
						onclick={() => set('phone_cols', 1)}>1 oszlop</button
					>
					<button
						type="button"
						role="radio"
						aria-checked={draft.layout.phone_cols === 2}
						class:active={draft.layout.phone_cols === 2}
						onclick={() => set('phone_cols', 2)}>2 oszlop</button
					>
				</div>
			</div>
		{/if}
		<label class="toggle">
			<span>Kérdés szövege a telefonon is</span>
			<input
				type="checkbox"
				checked={draft.layout.phone_prompt}
				onchange={(e) => set('phone_prompt', e.currentTarget.checked)}
			/>
		</label>
		<p class="dim">A válaszok szövege a telefonon mindig látszik.</p>
	{/if}

	{#if onapplyround}
		<button type="button" class="apply" onclick={onapplyround}
			>Alkalmazás a kör összes kérdésére</button
		>
	{/if}
</section>

<style>
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

	p {
		margin: 0;
	}

	.dim {
		color: var(--marquee-dim);
		font-size: 0.82rem;
	}

	.label {
		margin-top: 0.2rem;
		font-size: 0.82rem;
		color: var(--marquee-dim);
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.presets button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4rem 0.3rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-size: 0.75rem;
		line-height: 1.15;
	}

	.presets button.active {
		border: 2px solid var(--cyan);
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		font-weight: 700;
	}

	.presets svg {
		width: 100%;
		max-width: 4.5rem;
		height: auto;
	}

	.frame {
		fill: var(--cabinet);
		stroke: var(--field-border, #d5cec0);
	}

	.text {
		fill: var(--marquee);
		opacity: 0.75;
	}

	.img {
		fill: var(--marquee-dim);
		opacity: 0.35;
	}

	.ans {
		fill: var(--cyan);
		opacity: 0.55;
	}

	.solid {
		opacity: 0.9;
	}

	.segmented {
		display: inline-flex;
		align-self: flex-start;
		flex-wrap: wrap;
		padding: 3px;
		border-radius: 0.6rem;
		background: var(--cabinet);
	}

	.segmented button {
		height: 2rem;
		padding: 0 0.65rem;
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

	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 2rem;
		cursor: pointer;
	}

	.toggle input {
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--cyan);
	}

	.apply {
		min-height: 2.4rem;
		margin-top: 0.3rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	button:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}
</style>
