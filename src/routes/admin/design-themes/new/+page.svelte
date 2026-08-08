<script lang="ts">
	import { enhance } from '$app/forms';
	import { defaultTokens } from '$lib/theme/tokens';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

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

<main>
	<h1>Új design téma</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/create" use:enhance>
		<label>
			Név
			<input
				type="text"
				name="title"
				required
				maxlength="60"
				placeholder="pl. Kocsmai Krétatábla"
			/>
		</label>

		<label class="checkbox">
			<input type="checkbox" name="is_default" value="true" />
			Legyen ez az alapértelmezett téma
		</label>

		<label>
			Design tokenek (JSON — szín/font kulcs-érték párok)
			<textarea name="design_tokens" bind:value={tokensText} rows="16" spellcheck="false"
			></textarea>
		</label>
		{#if parseError}
			<p class="error">{parseError}</p>
		{/if}

		<button type="submit" disabled={!!parseError}>Létrehozás</button>
	</form>
</main>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 32rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.checkbox {
		flex-direction: row;
		align-items: center;
	}

	textarea {
		font-family: monospace;
		font-size: 0.8125rem;
	}

	.error {
		color: #b91c1c;
	}
</style>
