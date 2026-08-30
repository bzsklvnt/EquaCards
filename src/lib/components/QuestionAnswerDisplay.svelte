<script lang="ts">
	import ChoiceButton from './ChoiceButton.svelte';

	// Fázis P7 — a TV eddig máshogy jelenítette meg a kérdést, mint a
	// csapatok /play oldala: csak a promptot mutatta, az opciókat/csúszkát/
	// sorrendező listát egyáltalán nem. Ez a komponens a /play
	// (`src/routes/play/[pin]/+page.svelte`) `.options`/`.slider`/
	// `.ordering` blokkjaival AZONOS vizuális elrendezést/komponens-
	// struktúrát ad, csak nagy kijelzőre méretezve és NEM interaktívan
	// (a TV-n nincs érintés/kattintás — a csapatok a saját telefonjukon
	// válaszolnak) — docs/features/tv-mode.md.
	let {
		questionType,
		options,
		slider,
		orderingItems
	}: {
		questionType: string;
		options?: { id: string; option_text: string; image_url: string | null }[];
		slider?: { min_value: number; max_value: number; step: number };
		orderingItems?: { id: string; item_text: string }[];
	} = $props();
</script>

{#if questionType === 'single_choice' || questionType === 'multi_choice' || questionType === 'true_false'}
	<div class="answer-options">
		{#each options ?? [] as option (option.id)}
			<ChoiceButton text={option.option_text} imageUrl={option.image_url} disabled />
		{/each}
	</div>
{:else if questionType === 'slider' && slider}
	<div class="answer-slider">
		<span class="bound">{slider.min_value}</span>
		<input
			type="range"
			min={slider.min_value}
			max={slider.max_value}
			step={slider.step}
			value={(slider.min_value + slider.max_value) / 2}
			disabled
		/>
		<span class="bound">{slider.max_value}</span>
	</div>
{:else if questionType === 'ordering'}
	<ol class="answer-ordering">
		{#each orderingItems ?? [] as item (item.id)}
			<li>{item.item_text}</li>
		{/each}
	</ol>
{/if}

<style>
	.answer-options {
		display: grid;
		gap: 0.75rem;
		margin: 1.5rem auto;
		max-width: 48rem;
		font-size: clamp(1rem, 2.2vw, 1.5rem);
	}

	.answer-options :global(.choice) {
		padding: 1.25rem;
		font-size: inherit;
	}

	/* Fázis Q6 — TV kijelzőn a kép nagyobb, mint a csapatok telefonján. */
	.answer-options :global(.choice-image) {
		max-height: 16rem;
	}

	.answer-slider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem auto;
		max-width: 40rem;
	}

	.answer-slider input[type='range'] {
		flex: 1;
		height: 2.5rem;
		accent-color: var(--cyan);
	}

	.bound {
		font-family: var(--font-led);
		font-size: clamp(1rem, 2vw, 1.5rem);
		color: var(--marquee-dim);
	}

	.answer-ordering {
		list-style: decimal;
		text-align: left;
		margin: 1.5rem auto;
		max-width: 40rem;
		font-size: clamp(1rem, 2.2vw, 1.5rem);
	}

	.answer-ordering li {
		padding: 0.75rem 1rem;
		margin-bottom: 0.4rem;
		border: 1px solid var(--marquee-dim);
		border-radius: 0.375rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}
</style>
