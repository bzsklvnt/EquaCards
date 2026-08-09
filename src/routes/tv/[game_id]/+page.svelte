<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import QRCode from 'qrcode';
	import type {
		PresenceTeam,
		QuestionShowPayload,
		TimerStartPayload,
		QuestionRevealPayload,
		RoundLeaderboardRevealPayload,
		FinalLeaderboardRevealPayload
	} from '$lib/realtime/protocol';
	import { createReactiveThemeTokens } from '$lib/theme/reactive-tokens.svelte';
	import { playTick, playCountdownEnd, playReveal, playLeaderboard } from '$lib/audio/sfx';
	import { fireWinnerConfetti } from '$lib/effects/confetti';
	import PinDisplay from '$lib/components/PinDisplay.svelte';
	import TeamChip from '$lib/components/TeamChip.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import ReconnectOverlay from '$lib/components/ReconnectOverlay.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const game = untrack(() => data.game);

	let gameDesignThemeId = $state<string | null>(game.design_theme_id);
	// Fázis P5 — reaktív hook: a globális alapértelmezett VAGY az adott
	// este design_theme_id-jának változása (lásd lent, a games tábla
	// postgres_changes eseményéből élőben frissülő gameDesignThemeId)
	// azonnal, reload nélkül alkalmazódik.
	const theme = createReactiveThemeTokens(
		untrack(() => data.supabase),
		() => gameDesignThemeId
	);
	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);
	let gameStatus = $state(game.status);
	let connectionStatus = $state<'connected' | 'reconnecting' | 'disconnected'>('connected');

	let currentQuestion = $state<QuestionShowPayload | null>(null);
	let timerInfo = $state<TimerStartPayload | null>(null);
	let secondsLeft = $state(0);
	let locked = $state(false);
	let revealInfo = $state<QuestionRevealPayload | null>(null);
	let roundLeaderboard = $state<RoundLeaderboardRevealPayload | null>(null);
	let finalLeaderboard = $state<FinalLeaderboardRevealPayload | null>(null);

	let joinUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/play/${game.pin}` : ''
	);

	$effect(() => {
		if (!joinUrl) return;
		QRCode.toDataURL(joinUrl, { width: 320 }).then((url) => (qrDataUrl = url));
	});

	// Fázis P5 — ha a host átváltja EZ az este design témáját, amíg a TV
	// már nyitva van, a games sor postgres_changes eseménye frissíti a
	// gameDesignThemeId-t élőben — ez feeds a fenti reaktív hook-ba.
	$effect(() => {
		const themeChangesChannel = data.supabase
			.channel(`games_theme:${game.id}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'games',
					filter: `id=eq.${game.id}`
				},
				(payload) => {
					const newRow = payload.new as { design_theme_id: string | null };
					gameDesignThemeId = newRow.design_theme_id;
				}
			)
			.subscribe();

		return () => {
			themeChangesChannel.unsubscribe();
		};
	});

	onMount(() => {
		const channel = data.supabase.channel(`game:${game.id}`, {
			config: { presence: { key: crypto.randomUUID() } }
		});

		channel.on('presence', { event: 'sync' }, () => {
			const state = channel.presenceState<PresenceTeam>();
			teams = Object.values(state).flat();
		});

		channel.on('broadcast', { event: 'game_started' }, () => {
			gameStatus = 'active';
		});

		channel.on('broadcast', { event: 'question_show' }, ({ payload }) => {
			currentQuestion = payload as QuestionShowPayload;
			timerInfo = null;
			locked = false;
			revealInfo = null;
			roundLeaderboard = null;
		});

		channel.on('broadcast', { event: 'timer_start' }, ({ payload }) => {
			timerInfo = payload as TimerStartPayload;
		});

		channel.on('broadcast', { event: 'answer_locked' }, () => {
			locked = true;
		});

		channel.on('broadcast', { event: 'question_reveal' }, ({ payload }) => {
			revealInfo = payload as QuestionRevealPayload;
			playReveal();
		});

		channel.on('broadcast', { event: 'round_leaderboard_reveal' }, ({ payload }) => {
			roundLeaderboard = payload as RoundLeaderboardRevealPayload;
			currentQuestion = null;
			revealInfo = null;
			playLeaderboard();
			fireWinnerConfetti();
		});

		channel.on('broadcast', { event: 'final_leaderboard_reveal' }, ({ payload }) => {
			finalLeaderboard = payload as FinalLeaderboardRevealPayload;
			roundLeaderboard = null;
			playLeaderboard();
			fireWinnerConfetti();
		});

		channel.on('broadcast', { event: 'game_finished' }, () => {
			gameStatus = 'finished';
		});

		channel.subscribe((status) => {
			if (status === 'SUBSCRIBED') connectionStatus = 'connected';
			else if (status === 'CLOSED') connectionStatus = 'disconnected';
			else connectionStatus = 'reconnecting';
		});

		return () => {
			channel.unsubscribe();
		};
	});

	// Helyi visszaszámlálás — ugyanaz a minta, mint a csapat felületen, csak
	// itt nincs "önzáró" input, pusztán a nagy kijelzős számláló.
	$effect(() => {
		if (!timerInfo) {
			secondsLeft = 0;
			return;
		}
		const endTime = new Date(timerInfo.server_start_time).getTime() + timerInfo.duration * 1000;

		let lastWholeSecond = -1;
		const tick = () => {
			const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
			secondsLeft = remaining;
			if (remaining !== lastWholeSecond) {
				lastWholeSecond = remaining;
				if (remaining > 0 && remaining <= 5) playTick();
				else if (remaining === 0) playCountdownEnd();
			}
		};
		tick();
		const interval = setInterval(tick, 250);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{game.title} — Kivetítő</title>
</svelte:head>

<main class="cabinet" style={theme.css}>
	{#if connectionStatus !== 'connected'}
		<ReconnectOverlay />
	{/if}

	{#if finalLeaderboard}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h1>Végeredmény</h1>
			<div class="podium-list">
				{#each finalLeaderboard.standings as row, i (row.team_id)}
					<div in:fly={{ x: -40, delay: i * 150, duration: 350 }}>
						<PodiumCard rank={row.rank} name={row.name} score={row.total_score} />
					</div>
				{/each}
			</div>
		</div>
	{:else if roundLeaderboard}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h1>{roundLeaderboard.round_title} — Top 3</h1>
			<div class="podium-list">
				{#each roundLeaderboard.top3 as row, i (row.team_id)}
					<div in:fly={{ x: -40, delay: i * 150, duration: 350 }}>
						<PodiumCard rank={row.rank} name={row.name} score={row.round_score} />
					</div>
				{/each}
			</div>
		</div>
	{:else if revealInfo}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h2>Helyes válasz</h2>
			<p class="answer">{revealInfo.correct_answer}</p>
		</div>
	{:else if currentQuestion}
		{#key currentQuestion.question_id}
			<div class="screen" in:fly={{ y: 24, duration: 350 }}>
				<ArcadePanel>
					<p class="round-title">
						{currentQuestion.round_title} — {currentQuestion.order_index}/{currentQuestion.total_questions}
					</p>
					<p class="prompt">{currentQuestion.prompt}</p>
				</ArcadePanel>
			</div>
		{/key}
		{#if timerInfo}
			<div class="timer-wrap">
				{#if locked}
					<p class="locked-label">Lezárva</p>
				{:else}
					<TimerRing {secondsLeft} duration={timerInfo.duration} size={200} />
				{/if}
			</div>
		{/if}
	{:else if gameStatus === 'lobby'}
		<div class="screen lobby">
			<h1>{game.title}</h1>
			<PinDisplay pin={game.pin} {qrDataUrl} {joinUrl} />
			<p class="team-count">{teams.length} csapat csatlakozott</p>
			<div class="team-list">
				{#each teams as team (team.team_id)}
					<div in:fly={{ y: 8, duration: 200 }}>
						<TeamChip name={team.name} />
					</div>
				{/each}
			</div>
		</div>
	{:else if gameStatus === 'finished'}
		<div class="screen">
			<h1>Köszönjük a játékot!</h1>
		</div>
	{:else}
		<div class="screen">
			<h1>Készülj!</h1>
		</div>
	{/if}
</main>

<style>
	main.cabinet {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		text-align: center;
		padding: 3rem 2rem;
	}

	.screen {
		max-width: 70rem;
		width: 100%;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 5vw, 4rem);
		color: var(--cyan);
		line-height: 1.5;
		text-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 60%, transparent);
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 3vw, 2.25rem);
		color: var(--coin);
	}

	.round-title {
		color: var(--marquee-dim);
		font-size: clamp(1rem, 2.5vw, 1.75rem);
	}

	.prompt {
		font-size: clamp(1.5rem, 6vw, 4.5rem);
		margin: 1.5rem 0;
	}

	.answer {
		font-size: clamp(1.5rem, 5vw, 3.5rem);
		font-weight: bold;
		color: var(--power);
	}

	.timer-wrap {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}

	.locked-label {
		font-family: var(--font-display);
		font-size: clamp(1rem, 2.5vw, 1.5rem);
		color: var(--danger);
	}

	.lobby :global(.pin-panel) {
		margin: 1rem auto 0;
	}

	.team-count {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--magenta);
		margin-top: 2rem;
	}

	.team-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.podium-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.podium-list :global(.podium-card) {
		font-size: clamp(1.1rem, 3vw, 2.25rem);
		padding: 1rem 2rem;
	}
</style>
