<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import QRCode from 'qrcode';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type PresenceTeam = { team_id: string; name: string };

	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);

	let joinUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/play/${data.game.pin}` : ''
	);

	$effect(() => {
		if (!joinUrl) return;
		QRCode.toDataURL(joinUrl, { width: 240 }).then((url) => (qrDataUrl = url));
	});

	onMount(() => {
		const channel = data.supabase.channel(`game:${data.game.id}`, {
			config: { presence: { key: crypto.randomUUID() } }
		});

		channel.on('presence', { event: 'sync' }, () => {
			const state = channel.presenceState<PresenceTeam>();
			teams = Object.values(state).flat();
		});

		channel.subscribe();

		return () => {
			channel.unsubscribe();
		};
	});
</script>

<svelte:head>
	<title>{data.game.title} — Host</title>
</svelte:head>

<main>
	<a href={resolve('/admin/games/[id]', { id: data.game.id })}>← Vissza az estéhez</a>

	<h1>{data.game.title}</h1>

	<div class="join-box">
		<div class="pin">{data.game.pin}</div>
		{#if qrDataUrl}
			<img src={qrDataUrl} alt="QR kód a csatlakozáshoz" />
		{/if}
		<p>Csatlakozás: <code>{joinUrl}</code></p>
	</div>

	<h2>Csapatok ({teams.length})</h2>
	<ul>
		{#each teams as team (team.team_id)}
			<li>{team.name}</li>
		{:else}
			<li class="empty">Még senki sem csatlakozott.</li>
		{/each}
	</ul>
</main>

<style>
	main {
		max-width: 32rem;
		margin: 2rem auto;
		text-align: center;
	}

	.join-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		margin: 2rem 0;
	}

	.pin {
		font-size: 3rem;
		font-weight: bold;
		letter-spacing: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.empty {
		color: #666;
	}
</style>
