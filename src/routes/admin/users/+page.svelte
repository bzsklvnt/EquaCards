<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Select from '$lib/components/Select.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const handleRoleUpdate: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Jogosultság frissítve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a módosítás.');
			}
			await update();
		};
	};
</script>

<svelte:head>
	<title>Felhasználók — Kezelőfelület</title>
</svelte:head>

<h1>Felhasználók</h1>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<table>
	<thead>
		<tr>
			<th>Név</th>
			<th>Email</th>
			<th>Jogosultság</th>
			<th>Regisztrált</th>
		</tr>
	</thead>
	<tbody>
		{#each data.users as u (u.id)}
			<tr>
				<td data-label="Név">{u.display_name}</td>
				<td data-label="Email">{u.email ?? '—'}</td>
				<td data-label="Jogosultság">
					<form method="POST" action="?/updateRole" use:enhance={handleRoleUpdate}>
						<input type="hidden" name="user_id" value={u.id} />
						<Select
							label="Jogosultság"
							name="role_id"
							value={String(u.role_id)}
							onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
						>
							{#each data.roles as role (role.id)}
								<option value={role.id}>{role.label}</option>
							{/each}
						</Select>
					</form>
				</td>
				<td data-label="Regisztrált"
					>{u.created_at ? new Date(u.created_at).toLocaleDateString('hu-HU') : '—'}</td
				>
			</tr>
		{:else}
			<tr>
				<td colspan="4" class="empty-row">Még nincs regisztrált felhasználó.</td>
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
		vertical-align: middle;
	}

	th {
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	td form {
		margin: 0;
	}

	/* A "Jogosultság" oszlopfejléc már vizuálisan címkézi a select-et —
	   a mezőcímkét csak képernyőolvasóknak hagyjuk meg (display:none
	   kivenné az accessible name-ből is, nem csak vizuálisan tüntetné el). */
	td :global(.field-label) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.error {
		color: var(--danger);
	}

	.empty-row {
		color: var(--marquee-dim);
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
