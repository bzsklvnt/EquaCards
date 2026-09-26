<script lang="ts">
	import { resolve } from '$app/paths';
	import QuestionEditor from '$lib/builder/QuestionEditor.svelte';
	import { emptyDraft } from '$lib/builder/model';
	import { untrack } from 'svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	registerPageTour(() => 'question-form');

	const initial = untrack(() =>
		emptyDraft(
			data.questionTypes.find((t) => t.code === 'single_choice') ?? data.questionTypes[0],
			data.defaultThemeId ?? null
		)
	);
</script>

<svelte:head>
	<title>Új kérdés — Kezelőfelület</title>
</svelte:head>

<h1>Új kérdés</h1>
{#if data.round}
	<p class="context" data-tour="qf-round-context">
		A kérdés a kérdésbankba mentődik, és azonnal bekerül ide:
		<strong>{data.round.game_title} — {data.round.title}</strong>
	</p>
{/if}
<QuestionEditor
	{initial}
	types={data.questionTypes}
	themes={data.themes}
	readingDefault={data.readingDefault}
	action="?/create"
	error={form?.error}
	hiddenFields={data.round ? { round_id: data.round.id } : {}}
	cancelHref={data.round
		? resolve('/admin/games/[id]', { id: data.round.game_id })
		: resolve('/admin/questions')}
/>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	.context {
		color: var(--marquee-dim);
		margin-bottom: 1rem;
	}

	.context strong {
		color: var(--marquee);
	}
</style>
