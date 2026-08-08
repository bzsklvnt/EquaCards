<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>Kvízesték</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/create" use:enhance>
		<input type="text" name="title" placeholder="Új kvízeste neve" required />
		<button type="submit">Létrehozás</button>
	</form>

	<ul>
		{#each data.games as game (game.id)}
			<li>
				<a href={resolve('/admin/games/[id]', { id: game.id })}>{game.title}</a>
				<span class="status">{game.status}</span>
			</li>
		{:else}
			<li>Még nincs kvízeste.</li>
		{/each}
	</ul>
</main>

<style>
	form {
		display: inline-flex;
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
	}

	.status {
		color: #666;
		font-size: 0.875rem;
	}

	.error {
		color: #b91c1c;
	}
</style>
