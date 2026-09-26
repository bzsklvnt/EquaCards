<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import QuestionEditor from '$lib/builder/QuestionEditor.svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let deleting = $state(false);

	registerPageTour(() => 'question-form');
</script>

<svelte:head>
	<title>Kérdés szerkesztése — Kezelőfelület</title>
</svelte:head>

<h1>Kérdés szerkesztése</h1>
{#key data.draft.id}
	<QuestionEditor
		initial={data.draft}
		types={data.questionTypes}
		themes={data.themes}
		readingDefault={data.readingDefault}
		action="?/update"
		error={form?.error}
		cancelHref={resolve('/admin/questions')}
	/>
{/key}

<form
	method="POST"
	action="?/delete"
	use:enhance={withToast({ setSubmitting: (v) => (deleting = v) })}
	class="delete-form"
>
	<Button type="submit" variant="danger" loading={deleting}>Kérdés törlése</Button>
</form>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	.delete-form {
		margin-top: 1.5rem;
	}
</style>
