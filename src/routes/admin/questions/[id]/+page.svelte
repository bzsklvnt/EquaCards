<script lang="ts">
	import { enhance } from '$app/forms';
	import QuestionForm from '$lib/components/QuestionForm.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Kérdés szerkesztése — Kezelőfelület</title>
</svelte:head>

<h1>Kérdés szerkesztése</h1>
<QuestionForm
	themes={data.themes}
	questionTypes={data.questionTypes}
	action="?/update"
	error={form?.error}
	initial={{
		theme_id: data.question.theme_id,
		question_type_id: data.question.question_type_id,
		prompt: data.question.prompt,
		image_url: data.question.image_url,
		points: data.question.points ?? 1000,
		points_multiplier: data.question.points_multiplier ?? 1,
		time_limit_seconds: data.question.time_limit_seconds ?? 30,
		points_decay: data.question.points_decay ?? true,
		choiceOptions: data.choiceOptions,
		sliderConfig: data.sliderConfig,
		orderingItems: data.orderingItems
	}}
/>

<form method="POST" action="?/delete" use:enhance class="delete-form">
	<Button type="submit" variant="danger">Kérdés törlése</Button>
</form>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	.delete-form {
		margin-top: 1.5rem;
	}
</style>
