<script lang="ts">
	import { resolve } from '$app/paths';
	import { setConnectionStatusContext } from '$lib/realtime/connection-status.svelte';
	import { setHostProgressContext } from '$lib/realtime/host-progress.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const connectionStatus = setConnectionStatusContext();
	const progress = setHostProgressContext();

	let currentRoundIndex = $derived(
		data.rounds.findIndex((r) => r.id === data.game.current_round_id)
	);

	const statusLabel = {
		connected: 'Élő kapcsolat',
		reconnecting: 'Újracsatlakozás…',
		disconnected: 'Nincs kapcsolat'
	} as const;
</script>

<div class="host-shell">
	<header class="host-header">
		<div class="title-block">
			<span class="title">{data.game.title}</span>
			<span class="pin-badge">{data.game.pin}</span>
		</div>

		{#if data.game.status === 'active' && currentRoundIndex >= 0}
			<div class="progress-block">
				<span
					>{currentRoundIndex + 1}. kör / {data.rounds.length} · {data.rounds[currentRoundIndex]
						.title}</span
				>
				{#if progress.total !== null}
					<span>· Kérdés {progress.current}/{progress.total}</span>
				{/if}
			</div>
		{/if}

		<div class="status-block">
			<span class="dot {connectionStatus.status}" aria-hidden="true"></span>
			<span class="status-label">{statusLabel[connectionStatus.status]}</span>
			<a class="exit-link" href={resolve('/admin/games/[id]', { id: data.game.id })}>Kilépés</a>
		</div>
	</header>

	<div class="host-body">
		{@render children()}
	</div>
</div>

<style>
	.host-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.host-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem 1.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--cabinet-2, #211640);
		border-bottom: 2px solid var(--cabinet-3, #2c1d54);
		color: var(--marquee, #f5f0ff);
		font-family: var(--font-body, sans-serif);
		font-size: 0.875rem;
	}

	.title-block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: 600;
	}

	.pin-badge {
		font-family: var(--font-led, monospace);
		background: var(--cabinet-3, #2c1d54);
		color: var(--coin, #ffd23e);
		padding: 0.15rem 0.6rem;
		border-radius: 0.375rem;
		letter-spacing: 0.15rem;
	}

	.progress-block {
		display: flex;
		gap: 0.5rem;
		color: var(--marquee-dim, #a79bc9);
		flex: 1;
		justify-content: center;
	}

	.status-block {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--marquee-dim, #a79bc9);
	}

	.dot.connected {
		background: var(--power, #b6ff3e);
	}

	.dot.reconnecting {
		background: var(--coin, #ffd23e);
		animation: blink 1s ease-in-out infinite;
	}

	.dot.disconnected {
		background: var(--danger, #ff5a36);
	}

	@keyframes blink {
		50% {
			opacity: 0.3;
		}
	}

	.status-label {
		color: var(--marquee-dim, #a79bc9);
	}

	.exit-link {
		color: var(--marquee-dim, #a79bc9);
		text-decoration: none;
		border-left: 1px solid var(--cabinet-3, #2c1d54);
		padding-left: 0.75rem;
	}

	.exit-link:hover {
		color: var(--cyan, #35e7ff);
	}

	.host-body {
		flex: 1;
	}
</style>
