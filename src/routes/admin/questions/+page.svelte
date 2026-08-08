<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>Kérdésbank</h1>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<div class="toolbar">
		<form method="GET">
			<label>
				Téma szűrő
				<select name="theme_id" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
					<option value="">— összes —</option>
					{#each data.themes as theme (theme.id)}
						<option value={theme.id} selected={theme.id === data.themeFilter}>{theme.title}</option>
					{/each}
				</select>
			</label>
		</form>
		<a href={resolve('/admin/questions/new')}>+ Új kérdés</a>
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
					<td>{q.prompt}</td>
					<td>{q.themes?.title ?? '—'}</td>
					<td>{q.question_types?.label ?? '—'}</td>
					<td>{q.points}</td>
					<td>{q.last_used_at ? new Date(q.last_used_at).toLocaleDateString('hu-HU') : '—'}</td>
					<td>
						<a href={resolve(`/admin/questions/[id]`, { id: q.id })}>Szerkesztés</a>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={q.id} />
							<button type="submit">Törlés</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="6">Még nincs kérdés.</td></tr>
			{/each}
		</tbody>
	</table>
</main>

<style>
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: end;
		margin-bottom: 1rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid #eee;
	}

	td form {
		display: inline;
	}

	.error {
		color: #b91c1c;
	}
</style>
