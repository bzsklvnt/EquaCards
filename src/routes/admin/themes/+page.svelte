<script lang="ts">
	import { enhance } from '$app/forms';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newTitle = $state('');
</script>

<h1>Témák</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" action="?/create" use:enhance>
	<Input name="title" placeholder="Új téma neve" bind:value={newTitle} required />
	<Button type="submit">Hozzáadás</Button>
</form>

<ul>
	{#each data.themes as theme (theme.id)}
		<li>
			{theme.title}
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={theme.id} />
				<Button type="submit" variant="danger">Törlés</Button>
			</form>
		</li>
	{:else}
		<li class="empty">Még nincs téma.</li>
	{/each}
</ul>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	form {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--marquee);
	}

	.empty {
		color: var(--marquee-dim);
	}

	.error {
		color: var(--danger);
	}
</style>
