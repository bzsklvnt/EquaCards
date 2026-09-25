<script lang="ts">
	import { resolve } from '$app/paths';
	import QuestionForm from '$lib/components/QuestionForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Új kérdés — Kezelőfelület</title>
</svelte:head>

<h1>Új kérdés</h1>
{#if data.round}
	<p class="context">
		A kérdés a kérdésbankba mentődik, és azonnal bekerül ide:
		<strong>{data.round.game_title} — {data.round.title}</strong>
	</p>
{/if}
<QuestionForm
	themes={data.themes}
	questionTypes={data.questionTypes}
	action="?/create"
	error={form?.error}
	defaultThemeId={data.defaultThemeId}
	hiddenFields={data.round ? { round_id: data.round.id } : {}}
	cancelHref={data.round
		? resolve('/admin/games/[id]', { id: data.round.game_id })
		: resolve('/admin/questions')}
/>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	.context {
		color: var(--marquee-dim);
		margin-bottom: 1rem;
	}

	.context strong {
		color: var(--marquee);
	}
</style>
