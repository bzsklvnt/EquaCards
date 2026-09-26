<script lang="ts">
	import QuestionStage from '$lib/components/QuestionStage.svelte';
	import type { QuestionShowPayload } from '$lib/realtime/protocol';
	import { isChoiceType, type Draft } from './model';

	// Kivetítő-előnézet a kvízösszerakóban (P): a kérdés a válaszidő
	// fázisában, a saját megjelenése szerint, ahogy a TV-n megjelenik — a
	// helyes válasz NINCS jelölve, a videó helyett bélyegkép látszik.
	let {
		draft,
		roundTitle,
		position,
		total,
		readingSeconds
	}: {
		draft: Draft;
		roundTitle: string;
		position: number;
		total: number;
		readingSeconds: number;
	} = $props();

	const info = $derived(draft.type_code === 'info');

	const question = $derived<QuestionShowPayload>({
		question_id: draft.key,
		question_type: draft.type_code,
		round_title: roundTitle,
		prompt: draft.prompt || (info ? '— üres dia —' : '— üres kérdés —'),
		image_url: draft.image_url,
		image_pixelate: false,
		time_limit_seconds: draft.time_limit_seconds,
		order_index: position,
		total_questions: total,
		options: isChoiceType(draft.type_code)
			? draft.options.map((o, i) => ({
					id: String(i),
					option_text: o.text || '…',
					image_url: o.image_url
				}))
			: undefined,
		slider:
			draft.type_code === 'slider'
				? {
						min_value: draft.slider.min_value,
						max_value: draft.slider.max_value,
						step: draft.slider.step
					}
				: undefined,
		ordering_items:
			draft.type_code === 'ordering'
				? draft.ordering.map((t, i) => ({ id: String(i), item_text: t || '…' }))
				: undefined,
		layout: draft.layout,
		info_text: info ? draft.info_text : null,
		video: info ? null : draft.video
	});
</script>

<div class="frame">
	<QuestionStage
		{question}
		duration={info ? null : draft.time_limit_seconds}
		secondsLeft={draft.time_limit_seconds}
		preview
	/>
</div>
<p class="note">
	{#if info}
		Magyarázó dia: nincs időzítő és pont; a telefonokon „Nézd a kivetítőt” látszik.
	{:else if draft.video?.gate}
		A videó ({readingSeconds} mp) alatt a telefonokon a lapok inaktívak, utána indul a {draft.time_limit_seconds}
		mp válaszidő.
	{:else}
		{readingSeconds > 0
			? `Előtte ${readingSeconds} mp olvasási idő: csak a kérdés látszik, a gombok utána aktiválódnak.`
			: 'Nincs olvasási idő: a válaszidő azonnal indul.'}
		Válaszidő: {draft.time_limit_seconds} mp.
	{/if}
</p>

<style>
	.frame {
		display: flex;
		aspect-ratio: 16 / 9;
		max-height: 72vh;
		padding: 1.4rem 1.8rem;
		box-sizing: border-box;
		border: 10px solid #2e2c27;
		border-radius: 1.1rem;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		overflow: auto;
	}

	.note {
		margin: 0.6rem 0 0;
		color: var(--marquee-dim);
		font-size: 0.9rem;
		text-align: center;
	}
</style>
