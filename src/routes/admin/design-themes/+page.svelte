<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Vizuális témák — Admin</title>
</svelte:head>

<h1>Vizuális témák</h1>
<p class="hint">
	A vizuális köntös (szín/font token-készlet) teljesen független a kérdésbank tartalmi témáitól —
	bármelyik design téma bármelyik estéhez választható.
</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<Button href={resolve('/admin/design-themes/new')}>+ Új design téma</Button>

<ul>
	{#each data.designThemes as theme (theme.id)}
		<li>
			<a href={resolve('/admin/design-themes/[id]', { id: theme.id })}>{theme.title}</a>
			{#if theme.is_default}
				<span class="badge">alapértelmezett</span>
			{/if}
			{#if theme.is_default || data.designThemes.length === 1}
				<span class="hint-inline"
					>nem törölhető{theme.is_default
						? ' — előbb jelölj ki egy másikat alapértelmezettnek'
						: ''}</span
				>
			{:else}
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={theme.id} />
					<Button type="submit" variant="danger">Törlés</Button>
				</form>
			{/if}
		</li>
	{:else}
		<li class="empty">Még nincs design téma.</li>
	{/each}
</ul>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	.hint {
		color: var(--marquee-dim);
		max-width: 40rem;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1.5rem;
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

	.badge {
		font-size: 0.75rem;
		color: var(--cabinet);
		background: var(--power);
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.empty {
		color: var(--marquee-dim);
	}

	.hint-inline {
		color: var(--marquee-dim);
		font-size: 0.8rem;
	}

	.error {
		color: var(--danger);
	}
</style>
