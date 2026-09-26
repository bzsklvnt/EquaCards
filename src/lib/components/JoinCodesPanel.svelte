<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database.types';
	import Button from './Button.svelte';
	import Input from './Input.svelte';

	// Host lobby: a csapatkódos estén (games.join_requires_code) a kvízmester
	// itt látja a megerősített csapatok kódjait (ha valaki nem találja az
	// e-mailt), és itt vehet fel helyszíni csapatot — lásd
	// docs/features/landing-and-registration.md "Csapatkód".
	let {
		supabase,
		gameId,
		refreshKey = 0
	}: {
		supabase: SupabaseClient<Database>;
		gameId: string;
		/** Változásakor újratölt (pl. a csatlakozott csapatok száma). */
		refreshKey?: number;
	} = $props();

	type Row = { id: string; team_name: string; join_code: string; team_id: string | null };

	let rows = $state<Row[]>([]);
	let loadError = $state('');
	let walkinName = $state('');
	let walkinHeadcount = $state('4');
	let adding = $state(false);
	let addError = $state('');
	let lastCode = $state<{ name: string; code: string } | null>(null);

	async function load() {
		const { data, error } = await supabase
			.from('team_registrations')
			.select('id, team_name, join_code, team_id')
			.eq('game_id', gameId)
			.eq('status', 'confirmed')
			.order('team_name');
		loadError = error ? 'Nem sikerült betölteni a csapatkódokat.' : '';
		rows = data ?? [];
	}

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		refreshKey;
		load();
	});

	async function addWalkin(event: SubmitEvent) {
		event.preventDefault();
		adding = true;
		addError = '';
		const name = walkinName.trim();
		const { data, error } = await supabase.rpc('admin_add_walkin', {
			p_game_id: gameId,
			p_team_name: name,
			p_headcount: Number.parseInt(walkinHeadcount, 10)
		});
		adding = false;
		const row = data?.[0];
		if (error || !row) {
			addError = error?.message.includes('name_taken')
				? 'Ezen a néven már van csapat.'
				: 'Adj meg csapatnevet és 1–12 fős létszámot.';
			return;
		}
		lastCode = { name, code: row.join_code };
		walkinName = '';
		await load();
	}

	const joinedCount = $derived(rows.filter((r) => r.team_id).length);
</script>

<details class="codes">
	<summary>Csapatkódok ({joinedCount}/{rows.length} csatlakozott) · helyszíni csapat</summary>

	{#if loadError}<p class="error">{loadError}</p>{/if}
	<ul>
		{#each rows as row (row.id)}
			<li class:joined={row.team_id}>
				<span class="name">{row.team_name}</span>
				<code>{row.join_code}</code>
				<span class="state">{row.team_id ? 'bent van' : 'még nem'}</span>
			</li>
		{:else}
			<li class="empty">Nincs megerősített jelentkezés.</li>
		{/each}
	</ul>

	<form onsubmit={addWalkin}>
		<Input label="Helyszíni csapat neve" bind:value={walkinName} required maxlength={40} />
		<Input label="Fő" type="number" bind:value={walkinHeadcount} min={1} max={12} required />
		<Button type="submit" variant="secondary" loading={adding}>Kód kérése</Button>
	</form>
	{#if addError}<p class="error">{addError}</p>{/if}
	{#if lastCode}
		<p class="new-code" role="status">{lastCode.name}: <code>{lastCode.code}</code></p>
	{/if}
</details>

<style>
	.codes {
		border: var(--panel-border-width, 2px) solid var(--panel-border, var(--violet));
		border-radius: 0.75rem;
		background: var(--cabinet-2);
		padding: 0.6rem 0.9rem;
		color: var(--marquee);
		font-family: var(--font-body);
	}

	summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 32px;
		display: flex;
		align-items: center;
	}

	ul {
		margin: 0.5rem 0;
		padding: 0;
		list-style: none;
		max-height: 12rem;
		overflow-y: auto;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 4.5rem;
		gap: 0.75rem;
		align-items: center;
		padding: 0.3rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--marquee-dim) 25%, transparent);
		font-size: 0.9rem;
	}

	li.empty {
		display: block;
		color: var(--marquee-dim);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	code {
		font-family: var(--font-led), ui-monospace, monospace;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--coin);
	}

	.state {
		font-size: 0.8rem;
		color: var(--marquee-dim);
		text-align: right;
	}

	li.joined .state {
		color: var(--power);
	}

	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 4.5rem auto;
		gap: 0.5rem;
		align-items: end;
	}

	.new-code {
		margin: 0.5rem 0 0;
	}

	.new-code code {
		font-size: 1.3rem;
	}

	.error {
		margin: 0.4rem 0 0;
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
