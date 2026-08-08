<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>Vizuális témák</h1>
	<p class="hint">
		A vizuális köntös (szín/font token-készlet) teljesen független a kérdésbank tartalmi témáitól —
		bármelyik design téma bármelyik estéhez választható.
	</p>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<a class="new-link" href={resolve('/admin/design-themes/new')}>+ Új design téma</a>

	<ul>
		{#each data.designThemes as theme (theme.id)}
			<li>
				<a href={resolve('/admin/design-themes/[id]', { id: theme.id })}>{theme.title}</a>
				{#if theme.is_default}
					<span class="badge">alapértelmezett</span>
				{/if}
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={theme.id} />
					<button type="submit">Törlés</button>
				</form>
			</li>
		{:else}
			<li class="empty">Még nincs design téma.</li>
		{/each}
	</ul>
</main>

<style>
	.hint {
		color: #666;
		max-width: 40rem;
	}

	.new-link {
		display: inline-block;
		margin: 1rem 0;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.badge {
		font-size: 0.75rem;
		color: #15803d;
		background: #dcfce7;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.empty {
		color: #666;
	}

	.error {
		color: #b91c1c;
	}
</style>
