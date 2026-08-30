<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
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
	import { calibrateServerClock, serverNow } from '$lib/realtime/server-clock';
	import { playReveal, playLeaderboard, playJokerActivate } from '$lib/audio/sfx';
	import { getConnectionStatusContext } from '$lib/realtime/connection-status.svelte';
	import { getHostProgressContext } from '$lib/realtime/host-progress.svelte';
	import PinDisplay from '$lib/components/PinDisplay.svelte';
	import TeamChip from '$lib/components/TeamChip.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import QuestionRevealVisual from '$lib/components/QuestionRevealVisual.svelte';
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
		image_url: string | null;
	};

	const rounds = untrack(() => data.rounds);

	let game = $state(untrack(() => data.game));
	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);
	let questionTypes = $state<{ id: number; code: string }[]>([]);
	let roundQuestions = $state<RoundQuestionRow[]>([]);
	let uiStep = $state<
		'idle' | 'timing' | 'locked' | 'revealed' | 'round_summary' | 'final_summary'
	>('idle');
	let timerInfo = $state<TimerStartPayload | null>(null);
	let secondsLeft = $state(0);
	let statusMessage = $state('');
	let submissionCount = $state(0);
	let roundTop3 = $state<RoundLeaderboardRevealPayload['top3']>([]);
	let finalStandings = $state<FinalLeaderboardRevealPayload['standings']>([]);
	// Fázis P6 — a host is megtartja a saját maga által elküldött
	// question_show payload-ot, hogy a megoldás-feltáráskor meg tudja
	// jeleníteni az opciókat/csúszkát/sorrendező listát (korábban a host
	// felület egyáltalán nem jelenítette meg ezeket, csak a promptot).
	let currentQuestion = $state<QuestionShowPayload | null>(null);
	let revealInfo = $state<QuestionRevealPayload | null>(null);

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

	// Fázis O1 — a host korábban egyáltalán nem jelenítette meg a
	// visszaszámlálót; ugyanaz a helyi-óra minta, mint a /play és /tv
	// felületeken (docs/architecture/DATA_MODEL.md 5. szakasz).
	$effect(() => {
		if (!timerInfo) {
			secondsLeft = 0;
			return;
		}
		const endTime = new Date(timerInfo.server_start_time).getTime() + timerInfo.duration * 1000;

		const tick = () => {
			secondsLeft = Math.max(0, Math.round((endTime - serverNow()) / 1000));
		};
		tick();
		const interval = setInterval(tick, 250);
		return () => clearInterval(interval);
	});

	// Fázis P3 — a kör két esetben záruljon és táruljon fel automatikusan,
	// host-interakció nélkül: (1) lejár az idő, (2) minden csapat beküldte
	// a választ, mielőtt az idő lejárt volna. A `triggered` flag
	// biztosítja, hogy csak egyszer fusson le kérdésenként — az effect a
	// `secondsLeft` 250ms-os ketyegése és a `submissionCount` élő
	// frissülése miatt is újra és újra lefut, amíg 'timing' állapotban
	// vagyunk, de a flag miatt a lock+reveal csak az első teljesülő
	// feltételnél indul el. A host kézi "Zárás most"/"Megoldás feltárása"
	// gombjai változatlanul elérhetők maradnak (pl. technikai probléma
	// esetére) — ez az automatika csak egy plusz, alapértelmezett út.
	let autoAdvanceTriggered = $state(false);

	$effect(() => {
		if (uiStep !== 'timing') {
			autoAdvanceTriggered = false;
			return;
		}
		if (autoAdvanceTriggered) return;

		const timeUp = timerInfo !== null && secondsLeft <= 0;
		const allAnswered = teams.length > 0 && submissionCount >= teams.length;
		if (!timeUp && !allAnswered) return;

		autoAdvanceTriggered = true;
		autoLockAndReveal();
	});

	async function autoLockAndReveal() {
		await lockAnswers();
		await revealAnswer();
	}

	// Vizuális köntös (DATA_MODEL.md 8. szakasz) — a games.design_theme_id
	// alapján feloldott token-készlet a gyökér elemre kerül inline style-ként.
	// Fázis P5 — reaktív hook: a globális alapértelmezett VAGY az adott este
	// design_theme_id-jának változása azonnal, reload nélkül alkalmazódik.
	const theme = createReactiveThemeTokens(
		untrack(() => data.supabase),
		() => game.design_theme_id
	);

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

		// Fázis P3 — szinkron nullázás, mielőtt az új darabszám lekérdezése
		// (alant) megérkezne: az előző kérdés végleges (esetleg
		// "mindenki válaszolt") értéke enélkül egy pillanatra átcsúszna az
		// új kérdésre, és tévesen kiválthatná az automatikus lezárást.
		submissionCount = 0;

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
			.select('order_index, question_id, questions(prompt, question_type_id, image_url)')
			.eq('round_id', roundId)
			.order('order_index');

		roundQuestions = (rows ?? []).map((r) => ({
			order_index: r.order_index,
			question_id: r.question_id,
			prompt: r.questions?.prompt ?? '',
			question_type_id: r.questions?.question_type_id ?? 0,
			image_url: r.questions?.image_url ?? null
		}));
	}

	onMount(() => {
		let disposed = false;

		calibrateServerClock(data.supabase);

		(async () => {
			const { data: types } = await data.supabase.from('question_types').select('id, code');
			if (disposed) return;
			questionTypes = types ?? [];

			if (game.current_round_id) {
				await loadRoundQuestions(game.current_round_id);
			}
		})();

		channel = data.supabase.channel(`game:${game.id}`, {
			config: { presence: { key: crypto.randomUUID() }, broadcast: { self: true } }
		});

		channel.on('presence', { event: 'sync' }, () => {
			const state = channel!.presenceState<PresenceTeam>();
			teams = Object.values(state).flat();
		});

		// Fázis P2 — a timerInfo-t a host is a SAJÁT broadcast-jának
		// vételekor állítja be (self: true fent), nem a send() hívás
		// visszatérésekor közvetlenül. Korábban a host azonnal, a hálózati
		// broadcast-kézbesítés kivárása nélkül elindította a saját óráját,
		// míg a /play és /tv csak a broadcast tényleges megérkezésekor —
		// emiatt a host 2-3 másodperccel "előrébb" járt a visszaszámlálásban,
		// mint a csapatok/TV. Ugyanazon az úton keresztül állítva be
		// mindhárom felület ugyanannyi (elkerülhetetlen) kézbesítési
		// késéssel indul, tehát szinkronban marad egymással.
		channel.on('broadcast', { event: 'timer_start' }, ({ payload }) => {
			timerInfo = payload as TimerStartPayload;
		});

		// Fázis O4 — a team_joker_uses beszúrását mostantól a csapat kliense
		// végzi közvetlenül, szinkron módon (docs/features/scoring.md) — ez a
		// broadcast itt már csak a host UI-visszajelzésére szolgál, nem
		// adatírásra (a korábbi host-oldali insert versenyhelyzetet vitt be
		// a pontszámítás elé).
		channel.on('broadcast', { event: 'joker_activate' }, () => {
			statusMessage = `Joker aktiválva egy csapat által.`;
			playJokerActivate();
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
				.select('id, option_text, image_url, order_index')
				.eq('question_id', next.question_id)
				.order('order_index');
			optionsPayload = (options ?? []).map((o) => ({
				id: o.id,
				option_text: o.option_text,
				image_url: o.image_url
			}));
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
		statusMessage = '';
		currentQuestion = payload;
		revealInfo = null;

		// Fázis O1 — a timer korábban egy külön "Timer indítása" gombra várt;
		// mostantól a kérdés megjelenítésével egy menetben, azonnal indul.
		// A duration-t a fenti kérdés-lekérdezésből újrahasznosítjuk, nem kell
		// külön DB kör-utazás érte.
		const duration = question.time_limit_seconds ?? 30;

		// Sürgősségi javítás — a kezdő időbélyeg korábban a host kliens
		// saját Date.now()-jából jött (`new Date().toISOString()`), ami a
		// host eszközének óra-pontatlanságát minden más kliensre
		// ráterhelte (a /play és a /tv saját órája sem feltétlenül egyezik
		// a hosszéval VAGY egymáséval). A start_question_timer() RPC a
		// Postgres-szerver now()-ját írja be és adja vissza — egyetlen,
		// közös, tekintélyelvű időforrás, amihez minden kliens a saját
		// kalibrált óráját (serverNow(), src/lib/realtime/server-clock.ts)
		// méri, nem a host eszközének esetlegesen pontatlan óráját.
		const { data: serverStartTime, error: timerError } = await data.supabase.rpc(
			'start_question_timer',
			{ p_game_id: game.id, p_duration: duration }
		);
		if (timerError || !serverStartTime) {
			statusMessage = timerError?.message ?? 'Nem sikerült elindítani az időzítőt.';
			return;
		}

		await channel?.send({
			type: 'broadcast',
			event: 'timer_start',
			payload: {
				question_id: next.question_id,
				duration,
				server_start_time: serverStartTime
			}
		});
		// timerInfo-t a fenti self:true broadcast-feliratkozás állítja be
		// (Fázis P2), nem itt közvetlenül — lásd a channel.on('timer_start')
		// megjegyzését az onMount-ban.
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
		let correctOptionIds: string[] | undefined;
		let correctValue: number | undefined;
		let correctOrder: { id: string; item_text: string }[] | undefined;

		if (code === 'single_choice' || code === 'multi_choice' || code === 'true_false') {
			const { data: options } = await data.supabase
				.from('question_choice_options')
				.select('id, option_text, is_correct')
				.eq('question_id', current.question_id)
				.order('order_index');
			const correctOptions = (options ?? []).filter((o) => o.is_correct);
			correctAnswer = correctOptions.map((o) => o.option_text).join(', ');
			// Fázis P6 — csak reveal-kor kerül ki, melyik opció(k) helyesek
			// (a currentQuestion.options-ban, amit a csapatok is látnak,
			// szándékosan nincs is_correct — lásd protocol.ts).
			correctOptionIds = correctOptions.map((o) => o.id);
		} else if (code === 'slider') {
			const { data: config } = await data.supabase
				.from('question_slider_config')
				.select('correct_value')
				.eq('question_id', current.question_id)
				.single();
			correctAnswer = String(config?.correct_value ?? '');
			correctValue = config?.correct_value ?? undefined;
		} else if (code === 'ordering') {
			const { data: items } = await data.supabase
				.from('question_ordering_items')
				.select('id, item_text, correct_position')
				.eq('question_id', current.question_id)
				.order('correct_position');
			correctAnswer = (items ?? []).map((i) => i.item_text).join(' → ');
			correctOrder = (items ?? []).map((i) => ({ id: i.id, item_text: i.item_text }));
		}

		const payload: QuestionRevealPayload = {
			question_id: current.question_id,
			correct_answer: correctAnswer,
			correct_option_ids: correctOptionIds,
			correct_value: correctValue,
			correct_order: correctOrder
		};
		await channel?.send({ type: 'broadcast', event: 'question_reveal', payload });
		uiStep = 'revealed';
		timerInfo = null;
		revealInfo = payload;
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

<main class="cabinet" style={theme.css}>
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
				{#if connectionStatus.status !== 'connected'}
					<p class="loading">Csapatok betöltése…</p>
				{:else}
					<p class="empty">Még senki sem csatlakozott.</p>
				{/if}
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
					{#if roundQuestions[currentIndex].image_url}
						<img
							class="host-image-preview"
							src={roundQuestions[currentIndex].image_url}
							alt=""
							in:fade={{ duration: 200 }}
						/>
					{/if}
				{/key}
			</ArcadePanel>
		{/if}

		<!-- Fázis Q6 — a host saját maga tájékozódására: kis előnézet az
		     opciók képeiről is, ha vannak — currentQuestion (a host saját
		     broadcast payload-ja) csak akkor van kitöltve, ha a host EBBEN A
		     munkamenetben már elindította ezt a kérdést. -->
		{#if currentQuestion?.options?.some((o) => o.image_url)}
			<div class="host-option-previews">
				{#each currentQuestion.options ?? [] as option (option.id)}
					{#if option.image_url}
						<img class="host-image-preview small" src={option.image_url} alt={option.option_text} />
					{/if}
				{/each}
			</div>
		{/if}

		{#if uiStep === 'timing' || uiStep === 'locked'}
			<div class="timer-wrap">
				{#if uiStep === 'locked'}
					<p class="locked-label">Lezárva</p>
				{:else}
					<TimerRing {secondsLeft} duration={timerInfo?.duration ?? 0} />
				{/if}
			</div>
		{/if}

		{#if uiStep === 'revealed' && currentQuestion && revealInfo}
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
		{/if}

		<p class="submissions">Beérkezett válaszok: {submissionCount} / {teams.length}</p>

		<div class="controls">
			{#if uiStep === 'idle'}
				{#if currentIndex + 1 < roundQuestions.length}
					<Button onclick={showNextQuestion}>Következő kérdés</Button>
				{/if}
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
				{#if connectionStatus.status !== 'connected'}
					<p class="loading">Csapatok betöltése…</p>
				{:else}
					<p class="empty">Még senki sem csatlakozott.</p>
				{/if}
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

	/* Fázis Q6 — kis, kizárólag a host saját tájékozódására szolgáló
	   kép-előnézet; sosem foglal helyet, ha nincs image_url. */
	.host-image-preview {
		max-width: 100%;
		max-height: 8rem;
		border-radius: 0.5rem;
		border: 2px solid var(--marquee-dim);
		margin: 0 auto;
		display: block;
	}

	.host-option-previews {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}

	.host-image-preview.small {
		max-height: 4rem;
		max-width: 6rem;
		object-fit: contain;
	}

	.submissions {
		color: var(--marquee-dim);
		font-size: 0.875rem;
	}

	.timer-wrap {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}

	.locked-label {
		font-family: var(--font-display);
		font-size: 0.9rem;
		color: var(--danger);
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
