<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>Témák</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/create" use:enhance>
		<input type="text" name="title" placeholder="Új téma neve" required />
		<button type="submit">Hozzáadás</button>
	</form>

	<ul>
		{#each data.themes as theme (theme.id)}
			<li>
				{theme.title}
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={theme.id} />
					<button type="submit">Törlés</button>
				</form>
			</li>
		{:else}
			<li>Még nincs téma.</li>
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

	.error {
		color: #b91c1c;
	}
</style>
