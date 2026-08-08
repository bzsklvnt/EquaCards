<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newTitle = $state('');
</script>

<h1>Kvízesték</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" action="?/create" use:enhance>
	<Input name="title" placeholder="Új kvízeste neve" bind:value={newTitle} required />
	<Button type="submit">Létrehozás</Button>
</form>

<ul>
	{#each data.games as game (game.id)}
		<li>
			<a href={resolve('/admin/games/[id]', { id: game.id })}>{game.title}</a>
			<span class="status">{game.status}</span>
		</li>
	{:else}
		<li class="empty">Még nincs kvízeste.</li>
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

	li a {
		color: var(--cyan);
	}

	.status {
		color: var(--marquee-dim);
		font-size: 0.875rem;
	}

	.empty {
		color: var(--marquee-dim);
	}

	.error {
		color: var(--danger);
	}
</style>
