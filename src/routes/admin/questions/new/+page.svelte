<script lang="ts">
	import QuestionForm from '$lib/components/QuestionForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>Új kérdés</h1>
	<QuestionForm
		themes={data.themes}
		questionTypes={data.questionTypes}
		action="?/create"
		error={form?.error}
	/>
</main>
