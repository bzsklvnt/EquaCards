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
		FinalLeaderboardRevealPayload,
		QuestionStandingsRevealPayload,
		TvSoundPayload
	} from '$lib/realtime/protocol';
	import { createReactiveThemeTokens } from '$lib/theme/reactive-tokens.svelte';
	import { calibrateServerClock, serverNow } from '$lib/realtime/server-clock';
	// Hang CSAK a kivetítőn szól (a host és a csapatok telefonja néma) —
	// docs/features/tv-mode.md.
	import {
		isAudioRunning,
		playCountdownEnd,
		playJokerActivate,
		playLeaderboard,
		playReveal,
		playTick,
		setMuted,
		unlockAudio
	} from '$lib/audio/sfx';
	import { fireWinnerConfetti } from '$lib/effects/confetti';
	import PinDisplay from '$lib/components/PinDisplay.svelte';
	import TeamChip from '$lib/components/TeamChip.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import StandingsBoard from '$lib/components/StandingsBoard.svelte';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import ReconnectOverlay from '$lib/components/ReconnectOverlay.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import PixelatedImage from '$lib/components/PixelatedImage.svelte';
	import QuestionRevealVisual from '$lib/components/QuestionRevealVisual.svelte';
	import QuestionAnswerDisplay from '$lib/components/QuestionAnswerDisplay.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const game = untrack(() => data.game);

	let gameDesignThemeId = $state<string | null>(game.design_theme_id);
	// Fázis P5 — reaktív hook: a globális alapértelmezett VAGY az adott
	// este design_theme_id-jának változása (a játékcsatorna theme_changed
	// eseményéből élőben frissülő gameDesignThemeId) azonnal, reload nélkül
	// alkalmazódik.
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
	let readingLeft = $state(0);
	let locked = $state(false);
	// A böngésző csak kattintás után enged hangot — addig egy sáv kéri.
	let audioReady = $state(false);
	let soundMuted = $state(false);

	function enableAudio() {
		if (audioReady) return;
		unlockAudio();
		// A resume aszinkron; rövid késleltetéssel ellenőrizzük.
		setTimeout(() => (audioReady = isAudioRunning() || audioReady), 150);
		audioReady = true;
	}
	let revealInfo = $state<QuestionRevealPayload | null>(null);
	let roundLeaderboard = $state<RoundLeaderboardRevealPayload | null>(null);
	let questionStandings = $state<QuestionStandingsRevealPayload | null>(null);
	let finalLeaderboard = $state<FinalLeaderboardRevealPayload | null>(null);

	let joinUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/play/${game.pin}` : ''
	);

	$effect(() => {
		if (!joinUrl) return;
		QRCode.toDataURL(joinUrl, { width: 320 }).then((url) => (qrDataUrl = url));
	});

	// Oldalbetöltéskor és újracsatlakozáskor a kivetítő a szerverről tölti
	// vissza az aktuális kérdést (a kimaradt broadcastokat utólag nem kapja meg).
	async function restoreState() {
		const { data: state } = await data.supabase.rpc('current_question_state', {
			p_game_id: game.id
		});
		const s = state as {
			question_id: string | null;
			question_type?: string;
			round_title?: string;
			prompt?: string;
			image_url?: string | null;
			image_pixelate?: boolean;
			time_limit_seconds?: number;
			order_index?: number;
			total_questions?: number;
			options?: { id: string; option_text: string; image_url: string | null }[] | null;
			slider?: { min_value: number; max_value: number; step: number } | null;
			ordering_items?: { id: string; item_text: string }[] | null;
			server_start_time?: string | null;
			duration?: number | null;
			reading_seconds?: number | null;
			revealed?: boolean;
			correct_answer?: string | null;
		} | null;
		if (!s?.question_id || roundLeaderboard || finalLeaderboard || questionStandings) return;
		if (currentQuestion?.question_id !== s.question_id) {
			currentQuestion = {
				question_id: s.question_id,
				question_type: s.question_type ?? '',
				round_title: s.round_title ?? '',
				prompt: s.prompt ?? '',
				image_url: s.image_url ?? null,
				image_pixelate: s.image_pixelate ?? false,
				time_limit_seconds: s.time_limit_seconds ?? 30,
				order_index: s.order_index ?? 1,
				total_questions: s.total_questions ?? 1,
				options: s.options ?? undefined,
				slider: s.slider ?? undefined,
				ordering_items: s.ordering_items ?? undefined
			};
			locked = false;
			revealInfo = null;
			timerInfo = null;
		}
		if (s.revealed) {
			if (!revealInfo) {
				revealInfo = { question_id: s.question_id, correct_answer: s.correct_answer ?? '' };
			}
			locked = true;
			timerInfo = null;
		} else if (s.server_start_time && !timerInfo) {
			timerInfo = {
				question_id: s.question_id,
				duration: s.duration ?? 30,
				server_start_time: s.server_start_time,
				reading_seconds: s.reading_seconds ?? 0
			};
		}
	}

	onMount(() => {
		calibrateServerClock(data.supabase);

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

		// Az este témájának váltása (az adatbázis küldi).
		channel.on('broadcast', { event: 'theme_changed' }, ({ payload }) => {
			gameDesignThemeId = (payload as { design_theme_id: string | null }).design_theme_id;
		});

		channel.on('broadcast', { event: 'question_show' }, ({ payload }) => {
			currentQuestion = payload as QuestionShowPayload;
			timerInfo = null;
			locked = false;
			revealInfo = null;
			roundLeaderboard = null;
			questionStandings = null;
		});

		channel.on('broadcast', { event: 'timer_start' }, ({ payload }) => {
			timerInfo = payload as TimerStartPayload;
		});

		channel.on('broadcast', { event: 'answer_locked' }, () => {
			locked = true;
		});

		channel.on('broadcast', { event: 'tv_sound' }, ({ payload }) => {
			soundMuted = (payload as TvSoundPayload).muted;
			setMuted(soundMuted);
		});

		channel.on('broadcast', { event: 'joker_activate' }, () => {
			playJokerActivate();
		});

		channel.on('broadcast', { event: 'question_reveal' }, ({ payload }) => {
			revealInfo = payload as QuestionRevealPayload;
			playReveal();
		});

		channel.on('broadcast', { event: 'question_standings_reveal' }, ({ payload }) => {
			questionStandings = payload as QuestionStandingsRevealPayload;
			playLeaderboard();
		});

		channel.on('broadcast', { event: 'round_leaderboard_reveal' }, ({ payload }) => {
			roundLeaderboard = payload as RoundLeaderboardRevealPayload;
			questionStandings = null;
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
			if (status === 'SUBSCRIBED') {
				connectionStatus = 'connected';
				if (gameStatus === 'active' || gameStatus === 'paused') restoreState();
			} else if (status === 'CLOSED') connectionStatus = 'disconnected';
			else connectionStatus = 'reconnecting';
		});

		const onVisible = () => {
			if (document.visibilityState === 'visible' && gameStatus === 'active') restoreState();
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			channel.unsubscribe();
		};
	});

	// Helyi visszaszámlálás — ugyanaz a minta, mint a csapat felületen, csak
	// itt nincs "önzáró" input, pusztán a nagy kijelzős számláló.
	$effect(() => {
		if (!timerInfo) {
			secondsLeft = 0;
			readingLeft = 0;
			return;
		}
		const startTime = new Date(timerInfo.server_start_time).getTime();
		const endTime = startTime + timerInfo.duration * 1000;
		const duration = timerInfo.duration;

		let lastWholeSecond = -1;
		const tick = () => {
			const now = serverNow();
			readingLeft = Math.max(0, Math.ceil((startTime - now) / 1000));
			const remaining = Math.min(duration, Math.max(0, Math.round((endTime - now) / 1000)));
			secondsLeft = remaining;
			if (readingLeft === 0 && remaining !== lastWholeSecond) {
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

<svelte:window onpointerdown={enableAudio} onkeydown={enableAudio} />

<main class="cabinet" style={theme.css}>
	{#if connectionStatus !== 'connected'}
		<ReconnectOverlay />
	{/if}

	{#if !audioReady}
		<button type="button" class="sound-banner" onclick={enableAudio}>
			<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
				><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg
			>
			Kattints a hang bekapcsolásához — a visszaszámlálás és a jelzések itt, a kivetítőn szólnak.
		</button>
	{:else if soundMuted}
		<p class="sound-muted">Hang némítva (a kvízmester kapcsolta ki)</p>
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
	{:else if questionStandings}
		<div class="screen standings" in:fade={{ duration: 250 }}>
			<h1>Állás a körben</h1>
			<p class="round-title">
				{questionStandings.round_title} — {questionStandings.question_number}/{questionStandings.total_questions}.
				kérdés után
			</p>
			<StandingsBoard rows={questionStandings.standings} limit={8} size="lg" />
		</div>
	{:else if revealInfo}
		<div class="screen" in:fade={{ duration: 250 }}>
			<h2>Helyes válasz</h2>
			{#if currentQuestion}
				{#key revealInfo.question_id}
					<QuestionRevealVisual
						questionType={currentQuestion.question_type}
						options={currentQuestion.options}
						slider={currentQuestion.slider}
						orderingItems={currentQuestion.ordering_items}
						correctOptionIds={revealInfo.correct_option_ids}
						correctValue={revealInfo.correct_value}
						correctOrder={revealInfo.correct_order}
					/>
				{/key}
			{:else}
				<p class="answer">{revealInfo.correct_answer}</p>
			{/if}
		</div>
	{:else if currentQuestion}
		{#key currentQuestion.question_id}
			<div class="screen" in:fly={{ y: 24, duration: 350 }}>
				<ArcadePanel>
					<p class="round-title">
						{currentQuestion.round_title} — {currentQuestion.order_index}/{currentQuestion.total_questions}
					</p>
					<p class="prompt" class:reading={readingLeft > 0}>{currentQuestion.prompt}</p>
					{#if currentQuestion.image_url && currentQuestion.image_pixelate}
						<PixelatedImage
							--pixel-max-height="28rem"
							src={currentQuestion.image_url}
							startTime={timerInfo?.server_start_time ?? null}
							duration={timerInfo?.duration ?? 0}
							sharp={locked}
						/>
					{:else if currentQuestion.image_url}
						<img class="question-image" src={currentQuestion.image_url} alt="" />
					{/if}
				</ArcadePanel>
				<!-- Fázis P7 — a kérdés-prompt ÉS az opciók/csúszka/sorrendező
				     lista is ugyanabban a formátumban jelenik meg, mint a
				     csapatok /play oldalán (docs/features/tv-mode.md). -->
				{#if readingLeft > 0}
					<div class="reading" role="status" in:fade={{ duration: 200 }}>
						<span class="reading-count">{readingLeft}</span>
						<span>Olvassátok el — a válaszadás mindjárt indul</span>
					</div>
				{/if}
				<QuestionAnswerDisplay
					questionType={currentQuestion.question_type}
					options={currentQuestion.options}
					slider={currentQuestion.slider}
					orderingItems={currentQuestion.ordering_items}
					veiled={!timerInfo || readingLeft > 0}
				/>
			</div>
		{/key}
		{#if timerInfo && readingLeft === 0}
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
		padding: clamp(1rem, 4vh, 3rem) 2rem;
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
		text-shadow: 0 0 calc(16px * var(--glow, 1)) color-mix(in srgb, var(--cyan) 60%, transparent);
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

	.question-image {
		max-width: 100%;
		max-height: 28rem;
		border-radius: 0.75rem;
		margin: 0 auto 1rem;
		display: block;
	}

	.answer {
		font-size: clamp(1.5rem, 5vw, 3.5rem);
		font-weight: bold;
		color: var(--power);
	}

	.sound-banner {
		position: fixed;
		left: 50%;
		bottom: 1.2rem;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		max-width: min(46rem, calc(100vw - 2rem));
		padding: 0.8rem 1.2rem;
		border: 0;
		border-radius: 999px;
		background: var(--marquee);
		color: var(--cabinet-2);
		font: inherit;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
	}

	.sound-banner svg {
		flex-shrink: 0;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.sound-muted {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		margin: 0;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		background: var(--cabinet-2);
		color: var(--marquee-dim);
		font-size: 0.85rem;
	}

	.prompt.reading {
		font-size: clamp(1.8rem, 7vw, 5rem);
	}

	.reading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin: 0.5rem 0 0;
		font-size: clamp(1rem, 2.4vw, 1.6rem);
		color: var(--marquee-dim);
	}

	.reading-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		border: 5px solid var(--cyan);
		font-family: var(--font-display);
		font-size: 2.2rem;
		color: var(--marquee);
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

	/* Élő tesztből: a lobby-képernyőnek görgetés nélkül, egy nézetben kell
	   elférnie (TV/projektor) — a címsor és a térközök a magassághoz is
	   igazodnak, nem csak a szélességhez. */
	.lobby h1 {
		font-size: clamp(1.5rem, min(5vw, 7vh), 4rem);
		margin: 0 0 clamp(0.5rem, 2vh, 1.5rem);
	}

	.lobby :global(.pin-panel) {
		margin: 0 auto;
		width: fit-content;
	}

	.team-count {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--magenta);
		margin: clamp(0.75rem, 2.5vh, 2rem) 0 0;
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
