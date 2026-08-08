<script lang="ts">
	import QuestionForm from '$lib/components/QuestionForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Új kérdés — Kezelőfelület</title>
</svelte:head>

<h1>Új kérdés</h1>
<QuestionForm
	themes={data.themes}
	questionTypes={data.questionTypes}
	action="?/create"
	error={form?.error}
/>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}
</style>
