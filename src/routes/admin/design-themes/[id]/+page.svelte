<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Input from '$lib/components/Input.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let title = $state(untrack(() => data.designTheme.title));
	let isDefault = $state(untrack(() => data.designTheme.is_default));
	let saving = $state(false);
	let deleting = $state(false);
	let tokensText = $state(untrack(() => JSON.stringify(data.designTheme.design_tokens, null, 2)));
	let parseError = $derived.by(() => {
		try {
			JSON.parse(tokensText);
			return '';
		} catch {
			return 'Érvénytelen JSON.';
		}
	});
</script>

<svelte:head>
	<title>Design téma szerkesztése — Kezelőfelület</title>
</svelte:head>

<h1>Design téma szerkesztése</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form
	method="POST"
	action="?/update"
	use:enhance={withToast({ setSubmitting: (v) => (saving = v) })}
>
	<Input label="Név" name="title" bind:value={title} required maxlength={60} />

	<Checkbox
		label="Legyen ez az alapértelmezett téma"
		name="is_default"
		value="true"
		bind:checked={isDefault}
	/>

	<Textarea
		label="Design tokenek (JSON — szín/font kulcs-érték párok)"
		name="design_tokens"
		bind:value={tokensText}
		rows={16}
		spellcheck={false}
		monospace
	/>
	{#if parseError}
		<p class="error">{parseError}</p>
	{/if}

	<Button type="submit" disabled={!!parseError} loading={saving}>Mentés</Button>
</form>

<form
	method="POST"
	action="?/delete"
	use:enhance={withToast({ setSubmitting: (v) => (deleting = v) })}
	class="delete-form"
>
	<Button type="submit" variant="danger" loading={deleting}>Téma törlése</Button>
</form>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 32rem;
	}

	.delete-form {
		margin-top: 1.5rem;
	}

	.error {
		color: var(--danger);
	}
</style>
