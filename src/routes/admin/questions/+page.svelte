<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let themeFilter = $state(untrack(() => data.themeFilter ?? ''));
</script>

<svelte:head>
	<title>Kérdésbank — Kezelőfelület</title>
</svelte:head>

<h1>Kérdésbank</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<div class="toolbar">
	<form method="GET">
		<Select
			label="Téma szűrő"
			name="theme_id"
			bind:value={themeFilter}
			onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
		>
			<option value="">— összes —</option>
			{#each data.themes as theme (theme.id)}
				<option value={theme.id}>{theme.title}</option>
			{/each}
		</Select>
	</form>
	<Button href={resolve('/admin/questions/new')}>+ Új kérdés</Button>
</div>

<table>
	<thead>
		<tr>
			<th>Kérdés</th>
			<th>Téma</th>
			<th>Típus</th>
			<th>Pont</th>
			<th>Utoljára játszva</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.questions as q (q.id)}
			<tr>
				<td data-label="Kérdés">{q.prompt}</td>
				<td data-label="Téma">{q.themes?.title ?? '—'}</td>
				<td data-label="Típus">{q.question_types?.label ?? '—'}</td>
				<td data-label="Pont">{q.points}</td>
				<td data-label="Utoljára játszva"
					>{q.last_used_at ? new Date(q.last_used_at).toLocaleDateString('hu-HU') : '—'}</td
				>
				<td data-label="Műveletek">
					<a href={resolve(`/admin/questions/[id]`, { id: q.id })}>Szerkesztés</a>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={q.id} />
						<Button type="submit" variant="danger">Törlés</Button>
					</form>
				</td>
			</tr>
		{:else}
			<tr>
				<td colspan="6" class="empty-row">
					{#if themeFilter}
						Nincs kérdés ebben a témában.
						<a href={resolve('/admin/questions')}>Szűrő törlése</a>
					{:else}
						Még nincs kérdés.
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 1rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		color: var(--marquee);
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid var(--cabinet-3);
	}

	th {
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	td a {
		color: var(--cyan);
		margin-right: 0.75rem;
	}

	td form {
		display: inline;
	}

	.error {
		color: var(--danger);
	}

	.empty-row {
		color: var(--marquee-dim);
	}

	.empty-row a {
		color: var(--cyan);
		margin-left: 0.5rem;
	}

	/* Fázis N3 — a táblázat 640px alatt kártyás nézetté alakul, mert
	oszloponként vízszintesen csúnyán törne/scrollózna mobilon. */
	@media (max-width: 640px) {
		thead {
			display: none;
		}

		table,
		tbody,
		tr,
		td {
			display: block;
			width: 100%;
		}

		tr {
			background: var(--cabinet-2);
			border: 2px solid var(--cabinet-3);
			border-radius: 0.75rem;
			padding: 0.75rem;
			margin-bottom: 0.75rem;
		}

		td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 1rem;
			border-bottom: 1px solid var(--cabinet-3);
			text-align: right;
		}

		td:last-child {
			border-bottom: none;
		}

		td::before {
			content: attr(data-label);
			color: var(--marquee-dim);
			font-size: 0.8rem;
			text-align: left;
		}

		.empty-row {
			display: block;
			text-align: left;
		}

		.empty-row::before {
			content: none;
		}
	}
</style>
