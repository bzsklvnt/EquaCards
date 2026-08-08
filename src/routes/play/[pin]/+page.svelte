<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type JoinedInfo = { teamId: string; teamName: string; gameId: string };

	let storageKey = $derived(`equacards:team:${data.pin}`);

	let joined = $state<JoinedInfo | null>(null);
	let deviceToken = $state('');

	onMount(() => {
		deviceToken = crypto.randomUUID();

		const saved = localStorage.getItem(storageKey);
		if (saved) {
			try {
				joined = JSON.parse(saved);
			} catch {
				localStorage.removeItem(storageKey);
			}
		}
	});

	$effect(() => {
		if (form?.success && form.team && form.game) {
			const info: JoinedInfo = {
				teamId: form.team.id,
				teamName: form.team.name,
				gameId: form.game.id
			};
			localStorage.setItem(storageKey, JSON.stringify(info));
			joined = info;
		}
	});

	// Presence: a host lobby nézete ezen keresztül látja, mely csapatok vannak
	// éppen élőben csatlakozva. A `team_joined` broadcast egy egyszeri
	// értesítés is ugyanazon a csatornán — lásd docs/architecture/REALTIME_PROTOCOL.md.
	$effect(() => {
		const info = joined;
		if (!info) return;

		const channel = data.supabase.channel(`game:${info.gameId}`, {
			config: { presence: { key: info.teamId } }
		});

		channel.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await channel.track({ team_id: info.teamId, name: info.teamName });
				await channel.send({
					type: 'broadcast',
					event: 'team_joined',
					payload: { team_id: info.teamId, name: info.teamName }
				});
			}
		});

		return () => {
			channel.unsubscribe();
		};
	});
</script>

<svelte:head>
	<title>{data.game?.title ?? 'Csatlakozás'} — EquaCards</title>
</svelte:head>

<main>
	{#if !data.game}
		<h1>Nem található</h1>
		<p>A PIN nem található, vagy a játék már elindult.</p>
		<a href={resolve('/play')}>Vissza</a>
	{:else if joined}
		<h1>{data.game.title}</h1>
		<p>Csatlakoztál csapatként: <strong>{joined.teamName}</strong></p>
		<p>Várj, amíg a kvízmester elindítja a játékot…</p>
	{:else}
		<h1>{data.game.title}</h1>
		<form method="POST" action="?/join" use:enhance>
			<input type="hidden" name="device_token" value={deviceToken} />
			<label>
				Csapatnév
				<input type="text" name="name" required maxlength="40" />
			</label>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
			<button type="submit">Csatlakozás</button>
		</form>
	{/if}
</main>

<style>
	main {
		max-width: 20rem;
		margin: 4rem auto;
		text-align: center;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		text-align: left;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.error {
		color: #b91c1c;
	}
</style>
