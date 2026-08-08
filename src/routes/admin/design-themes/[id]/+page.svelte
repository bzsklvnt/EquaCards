<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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

<main>
	<h1>Design téma szerkesztése</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/update" use:enhance>
		<label>
			Név
			<input type="text" name="title" required maxlength="60" value={data.designTheme.title} />
		</label>

		<label class="checkbox">
			<input type="checkbox" name="is_default" value="true" checked={data.designTheme.is_default} />
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

		<button type="submit" disabled={!!parseError}>Mentés</button>
	</form>

	<form method="POST" action="?/delete" use:enhance>
		<button type="submit" class="delete">Téma törlése</button>
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

	.delete {
		margin-top: 1.5rem;
		background: #fee2e2;
		border: 1px solid #b91c1c;
		color: #b91c1c;
	}

	.error {
		color: #b91c1c;
	}
</style>
