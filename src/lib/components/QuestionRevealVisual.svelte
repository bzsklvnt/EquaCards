<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import ChoiceButton from './ChoiceButton.svelte';

	// Fázis P6 — a megoldás-feltárás vizuális feldúsítása CSAK a host és a
	// TV nézeten (a csapatok saját telefonján marad az egyszerű saját-
	// pontszám visszajelzés, docs/features/reveal-animations.md). Közös
	// komponens, mert a host és a TV feltárás-képernyője pontosan
	// ugyanazt kell mutassa, csak méretben/elrendezésben térhet el a
	// befoglaló felület.
	let {
		questionType,
		options,
		slider,
		orderingItems,
		correctOptionIds,
		correctValue,
		correctOrder
	}: {
		questionType: string;
		options?: { id: string; option_text: string }[];
		slider?: { min_value: number; max_value: number; step: number };
		orderingItems?: { id: string; item_text: string }[];
		correctOptionIds?: string[];
		correctValue?: number;
		correctOrder?: { id: string; item_text: string }[];
	} = $props();

	const correctSet = $derived(new Set(correctOptionIds ?? []));

	// A csúszka a beküldés utáni (itt: a kérdés kiinduló közép-) értékről
	// animálja a thumb-ot a helyes értékre — egy rövid Tween-nel (Fázis P6
	// spec: "CSS transition vagy egy rövid Svelte tweened/spring
	// animáció"). A natív <input type=range> value-jának gyors, ismételt
	// írása a Tween minden tick-jén vizuálisan simán mozgó thumb-ot ad.
	// Szándékosan csak a KEZDETI props-értékeket olvassa (untrack) — a
	// hívó oldal (`{#key question_id}`) mindig új komponens-példányt hoz
	// létre kérdésenként, egy már megjelenített feltárás props-ai nem
	// változnak menet közben.
	const sliderTween = new Tween(
		untrack(() => (slider ? (slider.min_value + slider.max_value) / 2 : 0)),
		{ duration: 700, easing: cubicOut }
	);

	let orderedItems = $state(untrack(() => [...(orderingItems ?? [])]));

	onMount(() => {
		if (slider && correctValue !== undefined) {
			sliderTween.target = correctValue;
		}
		if (correctOrder) {
			// Rövid késleltetés, hogy a kiinduló (kevert) sorrend egy
			// pillanatra látszódjon, mielőtt a szemünk láttára a helyes
			// sorrendbe rendeződik (FLIP-animáció a lenti animate:flip-pel).
			const finalOrder = correctOrder;
			const timeout = setTimeout(() => {
				orderedItems = finalOrder;
			}, 400);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if questionType === 'single_choice' || questionType === 'multi_choice' || questionType === 'true_false'}
	<div class="reveal-options">
		{#each options ?? [] as option (option.id)}
			<ChoiceButton text={option.option_text} disabled correct={correctSet.has(option.id)} />
		{/each}
	</div>
{:else if questionType === 'slider' && slider}
	<div class="reveal-slider">
		<input
			type="range"
			min={slider.min_value}
			max={slider.max_value}
			step={slider.step}
			value={sliderTween.current}
			disabled
		/>
		<p class="reveal-slider-value">{Math.round(sliderTween.current)}</p>
	</div>
{:else if questionType === 'ordering'}
	<ol class="reveal-ordering">
		{#each orderedItems as item (item.id)}
			<li animate:flip={{ duration: 500, easing: cubicOut }}>{item.item_text}</li>
		{/each}
	</ol>
{/if}

<style>
	.reveal-options {
		display: grid;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.reveal-slider {
		margin: 1.5rem 0;
	}

	.reveal-slider input[type='range'] {
		width: 100%;
		height: 44px;
		accent-color: var(--power);
	}

	.reveal-slider-value {
		font-family: var(--font-led);
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--power);
		text-align: center;
	}

	.reveal-ordering {
		list-style: decimal;
		text-align: left;
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.reveal-ordering li {
		padding: 0.75rem 0.5rem;
		min-height: 44px;
		display: flex;
		align-items: center;
		border: 2px solid var(--power);
		border-radius: 0.25rem;
		margin-bottom: 0.25rem;
		background: color-mix(in srgb, var(--power) 12%, var(--cabinet-2));
		color: var(--marquee);
	}
</style>
