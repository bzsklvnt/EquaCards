<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import QRCode from 'qrcode';
	import type {
		PresenceTeam,
		QuestionShowPayload,
		QuestionRevealPayload,
		JokerActivatePayload,
		RoundLeaderboardRevealPayload,
		FinalLeaderboardRevealPayload
	} from '$lib/realtime/protocol';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import { playReveal, playLeaderboard, playJokerActivate } from '$lib/audio/sfx';
	import { getConnectionStatusContext } from '$lib/realtime/connection-status.svelte';
	import { getHostProgressContext } from '$lib/realtime/host-progress.svelte';
	import PinDisplay from '$lib/components/PinDisplay.svelte';
	import TeamChip from '$lib/components/TeamChip.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const designThemes = untrack(() => data.designThemes);
	const connectionStatus = getConnectionStatusContext();
	const progress = getHostProgressContext();

	type RoundQuestionRow = {
		order_index: number;
		question_id: string;
		prompt: string;
		question_type_id: number;
	};

	const rounds = untrack(() => data.rounds);

	let game = $state(untrack(() => data.game));
	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);
	let questionTypes = $state<{ id: number; code: string }[]>([]);
	let roundQuestions = $state<RoundQuestionRow[]>([]);
	let uiStep = $state<
		'idle' | 'shown' | 'timing' | 'locked' | 'revealed' | 'round_summary' | 'final_summary'
	>('idle');
	let statusMessage = $state('');
	let submissionCount = $state(0);
	let roundTop3 = $state<RoundLeaderboardRevealPayload['top3']>([]);
	let finalStandings = $state<FinalLeaderboardRevealPayload['standings']>([]);
	let themeCss = $state(tokensToCssText(defaultTokens));

	let currentIndex = $derived(
		roundQuestions.findIndex((q) => q.question_id === game.current_question_id)
	);

	// A host header (Fázis F, src/routes/host/[game_id]/+layout.svelte) a
	// jelenlegi kérdés-progresst context-en keresztül olvassa, mivel a
	// roundQuestions ennek a page komponensnek a saját, kliens-oldali állapota.
	$effect(() => {
		if (game.status === 'active' && roundQuestions.length > 0) {
			progress.current = currentIndex + 1;
			progress.total = roundQuestions.length;
		} else {
			progress.current = null;
			progress.total = null;
		}
	});

	// Vizuális köntös (DATA_MODEL.md 8. szakasz) — a games.design_theme_id
	// alapján feloldott token-készlet a gyökér elemre kerül inline style-ként.
	$effect(() => {
		const themeId = game.design_theme_id;
		getActiveTokens(data.supabase, themeId).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});

	async function selectDesignTheme(themeId: string) {
		const { error } = await data.supabase
			.from('games')
			.update({ design_theme_id: themeId || null })
			.eq('id', game.id);
		if (error) {
			statusMessage = error.message;
			return;
		}
		game = { ...game, design_theme_id: themeId || null };
	}

	let channel: ReturnType<typeof data.supabase.channel> | undefined;

	let joinUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/play/${game.pin}` : ''
	);

	$effect(() => {
		if (!joinUrl) return;
		QRCode.toDataURL(joinUrl, { width: 240 }).then((url) => (qrDataUrl = url));
	});

	// Élő beküldési számláló az aktív kérdésre (docs/architecture/DATA_MODEL.md
	// 7. szakasz, Host felület: "Élő beküldési számláló — Postgres Changes az
	// answers táblán").
	$effect(() => {
		const questionId = game.current_question_id;
		if (!questionId || game.status !== 'active') {
			submissionCount = 0;
			return;
		}

		data.supabase
			.from('answers')
			.select('id', { count: 'exact', head: true })
			.eq('question_id', questionId)
			.then(({ count }) => (submissionCount = count ?? 0));

		const changesChannel = data.supabase
			.channel(`answers:${questionId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'answers',
					filter: `question_id=eq.${questionId}`
				},
				() => {
					submissionCount++;
				}
			)
			.subscribe();

		return () => {
			changesChannel.unsubscribe();
		};
	});

	async function loadRoundQuestions(roundId: string) {
		const { data: rows } = await data.supabase
			.from('round_questions')
			.select('order_index, question_id, questions(prompt, question_type_id)')
			.eq('round_id', roundId)
			.order('order_index');

		roundQuestions = (rows ?? []).map((r) => ({
			order_index: r.order_index,
			question_id: r.question_id,
			prompt: r.questions?.prompt ?? '',
			question_type_id: r.questions?.question_type_id ?? 0
		}));
	}

	onMount(() => {
		let disposed = false;

		(async () => {
			const { data: types } = await data.supabase.from('question_types').select('id, code');
			if (disposed) return;
			questionTypes = types ?? [];

			if (game.current_round_id) {
				await loadRoundQuestions(game.current_round_id);
			}
		})();

		channel = data.supabase.channel(`game:${game.id}`, {
			config: { presence: { key: crypto.randomUUID() } }
		});

		channel.on('presence', { event: 'sync' }, () => {
			const state = channel!.presenceState<PresenceTeam>();
			teams = Object.values(state).flat();
		});

		channel.on('broadcast', { event: 'joker_activate' }, async ({ payload }) => {
			const p = payload as JokerActivatePayload;
			const { error } = await data.supabase
				.from('team_joker_uses')
				.insert({ team_id: p.team_id, question_id: p.question_id, joker_type: p.joker_type });
			if (!error) {
				statusMessage = `Joker aktiválva egy csapat által.`;
				playJokerActivate();
			}
		});

		channel.subscribe((status) => {
			if (status === 'SUBSCRIBED') connectionStatus.status = 'connected';
			else if (status === 'CLOSED') connectionStatus.status = 'disconnected';
			else connectionStatus.status = 'reconnecting';
		});

		return () => {
			disposed = true;
			channel?.unsubscribe();
		};
	});

	function typeCode(questionTypeId: number) {
		return questionTypes.find((t) => t.id === questionTypeId)?.code ?? '';
	}

	function nextRoundAfterCurrent() {
		const idx = rounds.findIndex((r) => r.id === game.current_round_id);
		return rounds[idx + 1];
	}

	function shuffle<T>(arr: T[]): T[] {
		const copy = [...arr];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	async function startGame() {
		if (rounds.length === 0) {
			statusMessage = 'Nincs felvéve kör ehhez az estéhez.';
			return;
		}
		const firstRound = rounds[0];
		const { error } = await data.supabase
			.from('games')
			.update({
				status: 'active',
				current_round_id: firstRound.id,
				started_at: new Date().toISOString()
			})
			.eq('id', game.id);

		if (error) {
			statusMessage = error.message;
			return;
		}

		game = { ...game, status: 'active', current_round_id: firstRound.id };
		await loadRoundQuestions(firstRound.id);
		await channel?.send({ type: 'broadcast', event: 'game_started', payload: {} });
	}

	async function showNextQuestion() {
		const nextIndex = currentIndex + 1;
		const next = roundQuestions[nextIndex];
		if (!next) {
			statusMessage = 'Nincs több kérdés ebben a körben.';
			return;
		}

		const code = typeCode(next.question_type_id);

		const { data: question } = await data.supabase
			.from('questions')
			.select('id, prompt, image_url, time_limit_seconds')
			.eq('id', next.question_id)
			.single();

		if (!question) return;

		let optionsPayload: QuestionShowPayload['options'];
		let sliderPayload: QuestionShowPayload['slider'];
		let orderingPayload: QuestionShowPayload['ordering_items'];

		if (code === 'single_choice' || code === 'multi_choice' || code === 'true_false') {
			const { data: options } = await data.supabase
				.from('question_choice_options')
				.select('id, option_text, order_index')
				.eq('question_id', next.question_id)
				.order('order_index');
			optionsPayload = (options ?? []).map((o) => ({ id: o.id, option_text: o.option_text }));
		} else if (code === 'slider') {
			const { data: config } = await data.supabase
				.from('question_slider_config')
				.select('min_value, max_value, step')
				.eq('question_id', next.question_id)
				.single();
			if (config) sliderPayload = config;
		} else if (code === 'ordering') {
			const { data: items } = await data.supabase
				.from('question_ordering_items')
				.select('id, item_text')
				.eq('question_id', next.question_id);
			orderingPayload = shuffle(items ?? []);
		}

		const { error } = await data.supabase
			.from('games')
			.update({ current_question_id: next.question_id })
			.eq('id', game.id);
		if (error) {
			statusMessage = error.message;
			return;
		}
		game = { ...game, current_question_id: next.question_id };

		const round = rounds.find((r) => r.id === game.current_round_id);

		const payload: QuestionShowPayload = {
			question_id: question.id,
			question_type: code,
			round_title: round?.title ?? '',
			prompt: question.prompt,
			image_url: question.image_url,
			time_limit_seconds: question.time_limit_seconds ?? 30,
			order_index: nextIndex + 1,
			total_questions: roundQuestions.length,
			options: optionsPayload,
			slider: sliderPayload,
			ordering_items: orderingPayload
		};

		await channel?.send({ type: 'broadcast', event: 'question_show', payload });
		uiStep = 'shown';
		statusMessage = '';
	}

	async function startTimer() {
		const current = roundQuestions[currentIndex];
		if (!current) return;
		const { data: question } = await data.supabase
			.from('questions')
			.select('time_limit_seconds')
			.eq('id', current.question_id)
			.single();

		await channel?.send({
			type: 'broadcast',
			event: 'timer_start',
			payload: {
				question_id: current.question_id,
				duration: question?.time_limit_seconds ?? 30,
				server_start_time: new Date().toISOString()
			}
		});
		uiStep = 'timing';
	}

	async function lockAnswers() {
		const current = roundQuestions[currentIndex];
		if (!current) return;
		await channel?.send({
			type: 'broadcast',
			event: 'answer_locked',
			payload: { question_id: current.question_id }
		});
		uiStep = 'locked';
	}

	async function revealAnswer() {
		const current = roundQuestions[currentIndex];
		if (!current) return;

		const { error: evalError } = await data.supabase.rpc('evaluate_question', {
			p_question_id: current.question_id
		});
		if (evalError) {
			statusMessage = evalError.message;
			return;
		}

		const code = typeCode(current.question_type_id);
		let correctAnswer = '';

		if (code === 'single_choice' || code === 'multi_choice' || code === 'true_false') {
			const { data: options } = await data.supabase
				.from('question_choice_options')
				.select('option_text, is_correct')
				.eq('question_id', current.question_id)
				.order('order_index');
			correctAnswer = (options ?? [])
				.filter((o) => o.is_correct)
				.map((o) => o.option_text)
				.join(', ');
		} else if (code === 'slider') {
			const { data: config } = await data.supabase
				.from('question_slider_config')
				.select('correct_value')
				.eq('question_id', current.question_id)
				.single();
			correctAnswer = String(config?.correct_value ?? '');
		} else if (code === 'ordering') {
			const { data: items } = await data.supabase
				.from('question_ordering_items')
				.select('item_text, correct_position')
				.eq('question_id', current.question_id)
				.order('correct_position');
			correctAnswer = (items ?? []).map((i) => i.item_text).join(' → ');
		}

		const payload: QuestionRevealPayload = {
			question_id: current.question_id,
			correct_answer: correctAnswer
		};
		await channel?.send({ type: 'broadcast', event: 'question_reveal', payload });
		uiStep = 'revealed';
		playReveal();
	}

	async function revealRoundLeaderboard() {
		if (!game.current_round_id) return;
		const { data: rows, error } = await data.supabase.rpc('round_leaderboard', {
			p_round_id: game.current_round_id,
			p_limit: 3
		});
		if (error) {
			statusMessage = error.message;
			return;
		}

		roundTop3 = (rows ?? []).map((row, i) => ({
			team_id: row.team_id,
			name: row.name,
			round_score: row.round_score,
			rank: i + 1
		}));

		const round = rounds.find((r) => r.id === game.current_round_id);
		const payload: RoundLeaderboardRevealPayload = {
			round_id: game.current_round_id,
			round_title: round?.title ?? '',
			top3: roundTop3
		};
		await channel?.send({ type: 'broadcast', event: 'round_leaderboard_reveal', payload });
		uiStep = 'round_summary';
		playLeaderboard();
	}

	async function revealFinalLeaderboard() {
		const { data: rows, error } = await data.supabase
			.from('teams')
			.select('id, name, total_score')
			.eq('game_id', game.id)
			.order('total_score', { ascending: false });
		if (error) {
			statusMessage = error.message;
			return;
		}

		finalStandings = (rows ?? []).map((row, i) => ({
			team_id: row.id,
			name: row.name,
			total_score: row.total_score ?? 0,
			rank: i + 1
		}));

		const payload: FinalLeaderboardRevealPayload = { standings: finalStandings };
		await channel?.send({ type: 'broadcast', event: 'final_leaderboard_reveal', payload });
		uiStep = 'final_summary';
		playLeaderboard();
	}

	async function advanceToNextRound() {
		const next = nextRoundAfterCurrent();
		if (!next) {
			statusMessage = 'Nincs több kör — a "Játék befejezése" gombbal zárhatod le az estét.';
			return;
		}
		const { error } = await data.supabase
			.from('games')
			.update({ current_round_id: next.id, current_question_id: null })
			.eq('id', game.id);
		if (error) {
			statusMessage = error.message;
			return;
		}
		game = { ...game, current_round_id: next.id, current_question_id: null };
		await loadRoundQuestions(next.id);
		uiStep = 'idle';
	}

	async function finishGame() {
		const { error } = await data.supabase
			.from('games')
			.update({ status: 'finished', finished_at: new Date().toISOString() })
			.eq('id', game.id);
		if (error) {
			statusMessage = error.message;
			return;
		}
		game = { ...game, status: 'finished' };
		await channel?.send({ type: 'broadcast', event: 'game_finished', payload: {} });
	}
</script>

<svelte:head>
	<title>{game.title} — Host</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	{#if statusMessage}
		<p class="status-message">{statusMessage}</p>
	{/if}

	{#if game.status === 'lobby'}
		<PinDisplay pin={game.pin} {qrDataUrl} {joinUrl} />

		<div class="theme-picker">
			<Select
				label="Vizuális köntös"
				value={game.design_theme_id ?? ''}
				onchange={(e) => selectDesignTheme((e.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">Alapértelmezett</option>
				{#each designThemes as theme (theme.id)}
					<option value={theme.id}>{theme.title}</option>
				{/each}
			</Select>
		</div>

		<div class="actions">
			<Button onclick={startGame}>Kvíz indítása</Button>
			<Button
				variant="secondary"
				href={resolve('/tv/[game_id]', { game_id: game.id })}
				target="_blank"
				rel="noopener"
			>
				Kivetítő megnyitása (TV mód) →
			</Button>
		</div>

		<h2>Csapatok ({teams.length})</h2>
		<div class="team-list">
			{#each teams as team (team.team_id)}
				<TeamChip name={team.name} />
			{:else}
				<p class="empty">Még senki sem csatlakozott.</p>
			{/each}
		</div>
	{:else if game.status === 'active' && roundQuestions.length === 0}
		<p class="loading">Kérdések betöltése…</p>
	{:else if game.status === 'active'}
		<p class="round-label">{rounds.find((r) => r.id === game.current_round_id)?.title}</p>

		{#if roundQuestions[currentIndex]}
			<ArcadePanel>
				<p class="progress">Kérdés {currentIndex + 1} / {roundQuestions.length}</p>
				{#key roundQuestions[currentIndex].question_id}
					<p class="prompt" in:fly={{ y: 16, duration: 300 }}>
						{roundQuestions[currentIndex].prompt}
					</p>
				{/key}
			</ArcadePanel>
		{/if}

		<p class="submissions">Beérkezett válaszok: {submissionCount} / {teams.length}</p>

		<div class="controls">
			{#if uiStep === 'idle'}
				{#if currentIndex + 1 < roundQuestions.length}
					<Button onclick={showNextQuestion}>Következő kérdés</Button>
				{/if}
			{:else if uiStep === 'shown'}
				<Button onclick={startTimer}>Timer indítása</Button>
			{:else if uiStep === 'timing'}
				<Button onclick={lockAnswers}>Zárás most</Button>
			{:else if uiStep === 'locked'}
				<Button onclick={revealAnswer}>Megoldás feltárása</Button>
			{:else if uiStep === 'revealed'}
				{#if currentIndex + 1 < roundQuestions.length}
					<Button onclick={showNextQuestion}>Következő kérdés</Button>
				{:else if nextRoundAfterCurrent()}
					<Button onclick={revealRoundLeaderboard}>Kör eredményének feltárása</Button>
				{:else}
					<Button onclick={revealFinalLeaderboard}>Végeredmény feltárása</Button>
				{/if}
			{:else if uiStep === 'round_summary'}
				<div class="leaderboard" in:fade={{ duration: 200 }}>
					<h3>Kör vége — Top 3</h3>
					<div class="podium-list">
						{#each roundTop3 as row, i (row.team_id)}
							<div in:fly={{ x: -24, delay: i * 120, duration: 300 }}>
								<PodiumCard rank={row.rank} name={row.name} score={row.round_score} />
							</div>
						{/each}
					</div>
					<Button onclick={advanceToNextRound}>Következő kör</Button>
				</div>
			{:else if uiStep === 'final_summary'}
				<div class="leaderboard" in:fade={{ duration: 200 }}>
					<h3>Végeredmény</h3>
					<div class="podium-list">
						{#each finalStandings as row, i (row.team_id)}
							<div in:fly={{ x: -24, delay: i * 120, duration: 300 }}>
								<PodiumCard rank={row.rank} name={row.name} score={row.total_score} />
							</div>
						{/each}
					</div>
					<Button onclick={finishGame}>Játék lezárása</Button>
				</div>
			{/if}
		</div>

		<h2>Csapatok ({teams.length})</h2>
		<div class="team-list">
			{#each teams as team (team.team_id)}
				<TeamChip name={team.name} />
			{:else}
				<p class="empty">Még senki sem csatlakozott.</p>
			{/each}
		</div>
	{:else if game.status === 'finished'}
		<p>Ez a kvízeste lezárult.</p>
	{/if}
</main>

<style>
	main.cabinet {
		max-width: 32rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		text-align: center;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100%;
	}

	.theme-picker {
		max-width: 16rem;
		margin: 1.5rem auto;
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.round-label {
		font-weight: bold;
		margin-top: 1.5rem;
		color: var(--power);
	}

	.progress {
		color: var(--marquee-dim);
	}

	.prompt {
		font-size: 1.25rem;
		margin: 1rem 0;
	}

	.submissions {
		color: var(--marquee-dim);
		font-size: 0.875rem;
	}

	.controls {
		margin: 1.5rem 0;
	}

	.podium-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 20rem;
		margin: 1rem auto;
	}

	.leaderboard h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--coin);
	}

	.status-message {
		color: var(--coin);
	}

	.team-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}

	.empty {
		color: var(--marquee-dim);
	}

	.loading {
		color: var(--marquee-dim);
		font-family: var(--font-led);
	}
</style>
