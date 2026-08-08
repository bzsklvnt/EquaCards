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
	import { getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import { playTick, playCountdownEnd, playReveal, playLeaderboard } from '$lib/audio/sfx';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const game = untrack(() => data.game);

	let themeCss = $state('');
	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);
	let gameStatus = $state(game.status);

	let currentQuestion = $state<QuestionShowPayload | null>(null);
	let timerInfo = $state<TimerStartPayload | null>(null);
	let secondsLeft = $state(0);
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

	onMount(() => {
		getActiveTokens(data.supabase, game.design_theme_id).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});

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
			revealInfo = null;
			roundLeaderboard = null;
		});

		channel.on('broadcast', { event: 'timer_start' }, ({ payload }) => {
			timerInfo = payload as TimerStartPayload;
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
		});

		channel.on('broadcast', { event: 'final_leaderboard_reveal' }, ({ payload }) => {
			finalLeaderboard = payload as FinalLeaderboardRevealPayload;
			roundLeaderboard = null;
			playLeaderboard();
		});

		channel.on('broadcast', { event: 'game_finished' }, () => {
			gameStatus = 'finished';
		});

		channel.subscribe();

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

<main class="cabinet" style={themeCss}>
	{#if finalLeaderboard}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h1>Végeredmény</h1>
			<ol class="standings">
				{#each finalLeaderboard.standings as row, i (row.team_id)}
					<li in:fly={{ x: -40, delay: i * 150, duration: 350 }}>
						<span class="rank">{row.rank}.</span>
						<span class="name">{row.name}</span>
						<span class="score">{row.total_score} pont</span>
					</li>
				{/each}
			</ol>
		</div>
	{:else if roundLeaderboard}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h1>{roundLeaderboard.round_title} — Top 3</h1>
			<ol class="standings">
				{#each roundLeaderboard.top3 as row, i (row.team_id)}
					<li in:fly={{ x: -40, delay: i * 150, duration: 350 }}>
						<span class="rank">{row.rank}.</span>
						<span class="name">{row.name}</span>
						<span class="score">{row.round_score} pont</span>
					</li>
				{/each}
			</ol>
		</div>
	{:else if revealInfo}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h2>Helyes válasz</h2>
			<p class="answer">{revealInfo.correct_answer}</p>
		</div>
	{:else if currentQuestion}
		{#key currentQuestion.question_id}
			<div class="screen" in:fly={{ y: 24, duration: 350 }}>
				<p class="round-title">
					{currentQuestion.round_title} — {currentQuestion.order_index}/{currentQuestion.total_questions}
				</p>
				<p class="prompt">{currentQuestion.prompt}</p>
			</div>
		{/key}
		{#if timerInfo}
			<p class="timer" class:urgent={secondsLeft <= 5}>{secondsLeft}</p>
		{/if}
	{:else if gameStatus === 'lobby'}
		<div class="screen lobby">
			<h1>{game.title}</h1>
			<div class="pin">{game.pin}</div>
			{#if qrDataUrl}
				<img src={qrDataUrl} alt="QR kód a csatlakozáshoz" />
			{/if}
			<p class="join-hint">Csatlakozz a <strong>{joinUrl}</strong> címen!</p>
			<p class="team-count">{teams.length} csapat csatlakozott</p>
			<ul class="team-list">
				{#each teams as team (team.team_id)}
					<li in:fly={{ y: 8, duration: 200 }}>{team.name}</li>
				{/each}
			</ul>
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
		max-width: 60rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 4vw, 3rem);
		color: var(--cyan);
		line-height: 1.5;
		text-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 60%, transparent);
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 2.5vw, 1.75rem);
		color: var(--coin);
	}

	.round-title {
		color: var(--marquee-dim);
		font-size: clamp(1rem, 2vw, 1.5rem);
	}

	.prompt {
		font-size: clamp(1.5rem, 5vw, 3rem);
		margin: 1.5rem 0;
	}

	.answer {
		font-size: clamp(1.5rem, 4vw, 2.5rem);
		font-weight: bold;
		color: var(--power);
	}

	.timer {
		font-family: var(--font-led);
		font-size: clamp(3rem, 10vw, 6rem);
		font-weight: bold;
		color: var(--power);
	}

	.timer.urgent {
		color: var(--danger);
	}

	.lobby .pin {
		font-family: var(--font-led);
		font-size: clamp(3rem, 8vw, 5rem);
		letter-spacing: 0.5rem;
		color: var(--coin);
		margin: 1rem 0;
	}

	.lobby img {
		width: min(20rem, 60vw);
	}

	.join-hint {
		color: var(--marquee-dim);
		font-size: 1.1rem;
		margin-top: 1rem;
	}

	.team-count {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--magenta);
		margin-top: 2rem;
	}

	.team-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.team-list li {
		background: var(--cabinet-2);
		border: 1px solid var(--violet);
		border-radius: 999px;
		padding: 0.25rem 0.875rem;
		font-size: 0.9rem;
	}

	.standings {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.standings li {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: clamp(1.1rem, 2.5vw, 1.75rem);
		background: var(--cabinet-2);
		border-radius: 0.75rem;
		padding: 0.75rem 1.5rem;
	}

	.standings .rank {
		font-family: var(--font-led);
		color: var(--coin);
		width: 2ch;
	}

	.standings .name {
		flex: 1;
		text-align: left;
	}

	.standings .score {
		color: var(--power);
		font-weight: bold;
	}
</style>
