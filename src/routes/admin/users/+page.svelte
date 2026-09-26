<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Felhasználók (csak rendszergazda) — lista · profil és szerepkör ·
	// a szerepkörök jelentése. docs/features/admin-workspace.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'users');

	const ROLE_INFO: Record<number, string> = {
		1: 'Mindenhez hozzáfér: felhasználók, beállítások, kvízeste törlése.',
		2: 'Kérdésbank, témák, kvízesték összeállítása és lebonyolítása, helyszínek.',
		3: 'Élő lebonyolítás (host) és riportok — összeállítani nem tud.',
		4: 'Csak a riportokat látja.'
	};

	let search = $state('');
	const matches = (u: PageData['users'][number]) =>
		`${u.display_name} ${u.email ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
	const groups = $derived(
		data.roles
			.map((role) => ({
				label: role.label,
				items: data.users.filter((u) => u.role_id === role.id && matches(u))
			}))
			.filter((g) => g.items.length > 0)
	);
	const selection = createSelection(
		'id',
		() => groups.find((g) => g.items.length > 0)?.items[0]?.id ?? null
	);
	const selected = $derived(data.users.find((u) => u.id === selection.id) ?? null);

	let saving = $state(false);
	const handleRoleUpdate: SubmitFunction = () => {
		saving = true;
		return async ({ result, update }) => {
			saving = false;
			if (result.type === 'success') toast.success('Jogosultság frissítve.');
			else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a módosítás.');
			}
			await update();
		};
	};
</script>

<svelte:head>
	<title>Felhasználók — Kezelőfelület</title>
</svelte:head>

<Workspace
	label="Felhasználók"
	keys={[
		['↑ ↓', 'felhasználók'],
		['/', 'keresés']
	]}
>
	{#snippet rail()}
		<RailList
			label="Felhasználók"
			{groups}
			getId={(u) => u.id}
			selectedId={selection.id}
			onselect={(u) => selection.set(u.id)}
			onopen={() => document.getElementById('role-select')?.focus()}
			bind:search
			placeholder="Név vagy e-mail…"
			empty="Még nincs regisztrált felhasználó."
		>
			{#snippet item(u)}
				<span class="avatar" aria-hidden="true">{u.display_name.slice(0, 1)}</span>
				<span class="ws-item-text">
					<strong>{u.display_name}</strong>
					<small>{u.email ?? '—'}</small>
				</span>
			{/snippet}
		</RailList>
	{/snippet}

	{#snippet main()}
		{#if selected}
			<div class="ws-crumb">Felhasználók › <b>{selected.display_name}</b></div>
			<div class="ws-head">
				<div>
					<h1 class="ws-h1">{selected.display_name}</h1>
					<p class="ws-sub">
						{selected.email ?? 'nincs e-mail'} · regisztrált: {selected.created_at
							? new Date(selected.created_at).toLocaleDateString('hu-HU')
							: '—'}
					</p>
				</div>
			</div>
			<form
				method="POST"
				action="?/updateRole"
				class="ws-card"
				data-tour="us-table"
				use:enhance={handleRoleUpdate}
			>
				<h2>Jogosultság</h2>
				<input type="hidden" name="user_id" value={selected.id} />
				<div class="roles" role="radiogroup" aria-label="Jogosultság" data-tour="us-role">
					{#each data.roles as role (role.id)}
						<label class="role" class:on={selected.role_id === role.id}>
							<input
								id={role.id === selected.role_id ? 'role-select' : undefined}
								type="radio"
								name="role_id"
								value={role.id}
								checked={selected.role_id === role.id}
								disabled={saving}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
							<span class="role-text">
								<strong>{role.label}</strong>
								<small>{ROLE_INFO[role.id] ?? ''}</small>
							</span>
						</label>
					{/each}
				</div>
				<p class="ws-note">
					A változás azonnal érvényes. A saját rendszergazda jogodat nem veheted el.
				</p>
			</form>
		{:else}
			<div class="ws-empty">
				<h2>Felhasználók</h2>
				<p>Még nincs regisztrált felhasználó.</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		<p class="ws-cap">Szerepkörök</p>
		{#each data.roles as role (role.id)}
			<div class="role-info">
				<strong>{role.label}</strong>
				<span>{data.users.filter((u) => u.role_id === role.id).length} fő</span>
			</div>
		{/each}
	{/snippet}
</Workspace>

<style>
	.avatar {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--cabinet);
		font-weight: 700;
		text-transform: uppercase;
	}

	.roles {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.role {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.7rem;
		cursor: pointer;
	}

	.role.on {
		border: 2px solid var(--cyan);
		background: color-mix(in srgb, var(--cyan) 8%, var(--cabinet-2));
	}

	.role input {
		accent-color: var(--cyan);
		width: 1.1rem;
		height: 1.1rem;
	}

	.role-text {
		display: flex;
		flex-direction: column;
	}

	.role-text small {
		color: var(--marquee-dim);
	}

	.role-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
	}

	.role-info span {
		color: var(--marquee-dim);
	}
</style>
