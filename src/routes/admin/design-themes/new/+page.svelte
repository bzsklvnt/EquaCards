<script lang="ts">
	import { enhance } from '$app/forms';
	import { defaultTokens } from '$lib/theme/tokens';
	import Input from '$lib/components/Input.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let title = $state('');
	let isDefault = $state(false);
	let creating = $state(false);
	let tokensText = $state(JSON.stringify(defaultTokens, null, 2));
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
	<title>Új design téma — Kezelőfelület</title>
</svelte:head>

<h1>Új design téma</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form
	method="POST"
	action="?/create"
	use:enhance={withToast({ setSubmitting: (v) => (creating = v) })}
>
	<Input
		label="Név"
		name="title"
		bind:value={title}
		required
		maxlength={60}
		placeholder="pl. Kocsmai Krétatábla"
	/>

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

	<Button type="submit" disabled={!!parseError} loading={creating}>Létrehozás</Button>
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

	.error {
		color: var(--danger);
	}
</style>
