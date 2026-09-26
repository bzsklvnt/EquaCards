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
		FinalLeaderboardRevealPayload,
		QuestionStandingsRevealPayload,
		RoundStandingsUpdatePayload,
		TvSoundPayload
	} from '$lib/realtime/protocol';
	import { rankRows } from '$lib/realtime/standings';
	import { createReactiveThemeTokens } from '$lib/theme/reactive-tokens.svelte';
	import { calibrateServerClock, serverNow } from '$lib/realtime/server-clock';
	// Hang csak a kivetítőn szól (docs/features/tv-mode.md) — a host néma, de
	// M-mel távolról némíthatja a kivetítőt.
	import { getConnectionStatusContext } from '$lib/realtime/connection-status.svelte';
	import { getHostProgressContext } from '$lib/realtime/host-progress.svelte';
	import PinDisplay from '$lib/components/PinDisplay.svelte';
	import TeamChip from '$lib/components/TeamChip.svelte';
	import JoinCodesPanel from '$lib/components/JoinCodesPanel.svelte';
	import PodiumCard from '$lib/components/PodiumCard.svelte';
	import StandingsBoard from '$lib/components/StandingsBoard.svelte';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
	import QuestionRevealVisual from '$lib/components/QuestionRevealVisual.svelte';
	import ShortcutHelp, { type ShortcutGroup } from '$lib/components/ShortcutHelp.svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
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
		image_pixelate: boolean;
		/** A kvízösszerakóban beállított alapértelmezés: felfedés után a
		 * kivetítős állás a kiemelt következő lépés (S-sel kihagyható). */
		show_standings: boolean;
	};

	const rounds = untrack(() => data.rounds);

	let game = $state(untrack(() => data.game));
	let qrDataUrl = $state('');
	let teams = $state<PresenceTeam[]>([]);
	let questionTypes = $state<{ id: number; code: string }[]>([]);
	let roundQuestions = $state<RoundQuestionRow[]>([]);
	let uiStep = $state<
		| 'idle'
		| 'timing'
		| 'locked'
		| 'revealed'
		| 'question_standings'
		| 'round_summary'
		| 'final_summary'
	>('idle');
	let timerInfo = $state<TimerStartPayload | null>(null);
	let secondsLeft = $state(0);
	let readingLeft = $state(0);
	let tvMuted = $state(false);
	let helpOpen = $state(false);
	let codesOpen = $state(false);
	let acting = $state(false);
	let lastActionAt = 0;
	let statusMessage = $state('');
	let submissionCount = $state(0);
	let roundTop3 = $state<RoundLeaderboardRevealPayload['top3']>([]);
	// Kérdésenkénti állás a körön belül: az előző feltárt állás (helyezés-
	// változáshoz és a kérdésnél szerzett ponthoz), körönként újrakezdve.
	let questionStandings = $state<QuestionStandingsRevealPayload['standings']>([]);
	let previousStandings = $state<{
		roundId: string;
		byTeam: Record<string, { rank: number; score: number }>;
	} | null>(null);
	let finalStandings = $state<FinalLeaderboardRevealPayload['standings']>([]);
	// Fázis P6 — a host is megtartja a saját maga által elküldött
	// question_show payload-ot, hogy a megoldás-feltáráskor meg tudja
	// jeleníteni az opciókat/csúszkát/sorrendező listát (korábban a host
	// felület egyáltalán nem jelenítette meg ezeket, csak a promptot).
	let currentQuestion = $state<QuestionShowPayload | null>(null);
	let revealInfo = $state<QuestionRevealPayload | null>(null);

	registerPageTour(() =>
		game.status === 'lobby' ? 'host-lobby' : game.status === 'active' ? 'host-live' : null
	);

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
			readingLeft = 0;
			return;
		}
		const startTime = new Date(timerInfo.server_start_time).getTime();
		const endTime = startTime + timerInfo.duration * 1000;
		const duration = timerInfo.duration;

		const tick = () => {
			const now = serverNow();
			// Olvasási idő: a válaszidő a server_start_time-nál indul.
			readingLeft = Math.max(0, Math.ceil((startTime - now) / 1000));
			secondsLeft = Math.min(duration, Math.max(0, Math.round((endTime - now) / 1000)));
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
		void autoLockAndReveal();
	});

	// A kézi lépésekkel közös védelmen fut (runAction): ha a host épp akkor
	// nyom Space-t, a lezárás és a felfedés nem fut le kétszer.
	async function autoLockAndReveal() {
		if (acting) {
			// Egy kézi lépés fut (pl. épp a "Zárás most"); utána, ha még kell, folytatjuk.
			while (acting) await new Promise((r) => setTimeout(r, 50));
		}
		if (uiStep !== 'timing') return;
		acting = true;
		lastActionAt = Date.now();
		try {
			await lockAnswers();
			await revealAnswer();
		} finally {
			acting = false;
		}
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
			.select(
				'order_index, question_id, show_standings, questions(prompt, question_type_id, image_url, image_pixelate)'
			)
			.eq('round_id', roundId)
			.order('order_index');

		roundQuestions = (rows ?? []).map((r) => ({
			order_index: r.order_index,
			question_id: r.question_id,
			prompt: r.questions?.prompt ?? '',
			question_type_id: r.questions?.question_type_id ?? 0,
			image_url: r.questions?.image_url ?? null,
			image_pixelate: r.questions?.image_pixelate ?? false,
			show_standings: r.show_standings
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

		// Egyetlen hívás (host_next_question): beállítja az aktuális kérdést,
		// elindítja az időzítőt (a Postgres-szerver órájával, olvasási idővel —
		// docs/features/timer.md), és visszaadja a csapatoknak kiküldendő adatokat
		// (helyes válasz nélkül).
		const { data: started, error } = await data.supabase.rpc('host_next_question', {
			p_game_id: game.id,
			p_question_id: next.question_id
		});
		const q = started as {
			question_id: string;
			prompt: string;
			image_url: string | null;
			image_pixelate: boolean;
			time_limit_seconds: number;
			options: { id: string; option_text: string; image_url: string | null }[] | null;
			slider: { min_value: number; max_value: number; step: number } | null;
			ordering_items: { id: string; item_text: string }[] | null;
			server_start_time: string;
			reading_seconds: number;
		} | null;
		if (error || !q?.server_start_time) {
			statusMessage = error?.message ?? 'Nem sikerült elindítani a kérdést.';
			return;
		}
		game = { ...game, current_question_id: next.question_id };

		const round = rounds.find((r) => r.id === game.current_round_id);

		const payload: QuestionShowPayload = {
			question_id: q.question_id,
			question_type: code,
			round_title: round?.title ?? '',
			prompt: q.prompt,
			image_url: q.image_url,
			image_pixelate: q.image_pixelate,
			time_limit_seconds: q.time_limit_seconds,
			order_index: nextIndex + 1,
			total_questions: roundQuestions.length,
			options: q.options ?? undefined,
			slider: q.slider ?? undefined,
			ordering_items: q.ordering_items ? shuffle(q.ordering_items) : undefined
		};

		await channel?.send({ type: 'broadcast', event: 'question_show', payload });
		statusMessage = '';
		currentQuestion = payload;
		revealInfo = null;

		await channel?.send({
			type: 'broadcast',
			event: 'timer_start',
			payload: {
				question_id: next.question_id,
				duration: q.time_limit_seconds,
				server_start_time: q.server_start_time,
				reading_seconds: q.reading_seconds
			} satisfies TimerStartPayload
		});
		// timerInfo-t a fenti self:true broadcast-feliratkozás állítja be
		// (Fázis P2), nem itt közvetlenül — lásd a channel.on('timer_start')
		// megjegyzését az onMount-ban.
		uiStep = 'timing';
	}

	// Space az olvasási idő alatt: a válaszidő azonnal indul.
	async function skipReading() {
		const current = roundQuestions[currentIndex];
		if (!current || readingLeft <= 0) return;
		const { data: skipped, error } = await data.supabase.rpc('skip_question_reading', {
			p_game_id: game.id
		});
		const res = skipped as { server_start_time: string; duration: number } | null;
		if (error || !res) {
			statusMessage = error?.message ?? 'Nem sikerült átugrani az olvasási időt.';
			return;
		}
		await channel?.send({
			type: 'broadcast',
			event: 'timer_start',
			payload: {
				question_id: current.question_id,
				duration: res.duration,
				server_start_time: res.server_start_time,
				reading_seconds: 0
			} satisfies TimerStartPayload
		});
	}

	async function toggleTvSound() {
		tvMuted = !tvMuted;
		await channel?.send({
			type: 'broadcast',
			event: 'tv_sound',
			payload: { muted: tvMuted } satisfies TvSoundPayload
		});
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

		// Egy hívás (host_reveal): kiértékel (evaluate_question) és visszaadja a
		// helyes választ.
		const { data: revealed, error: evalError } = await data.supabase.rpc('host_reveal', {
			p_question_id: current.question_id
		});
		if (evalError) {
			statusMessage = evalError.message;
			return;
		}
		const r = revealed as {
			options: { id: string; option_text: string; is_correct: boolean }[] | null;
			correct_value: number | null;
			ordering: { id: string; item_text: string }[] | null;
		} | null;

		const code = typeCode(current.question_type_id);
		let correctAnswer = '';
		let correctOptionIds: string[] | undefined;
		let correctValue: number | undefined;
		let correctOrder: { id: string; item_text: string }[] | undefined;

		if (code === 'single_choice' || code === 'multi_choice' || code === 'true_false') {
			const correctOptions = (r?.options ?? []).filter((o) => o.is_correct);
			correctAnswer = correctOptions.map((o) => o.option_text).join(', ');
			// Fázis P6 — csak reveal-kor kerül ki, melyik opció(k) helyesek
			// (a currentQuestion.options-ban, amit a csapatok is látnak,
			// szándékosan nincs is_correct — lásd protocol.ts).
			correctOptionIds = correctOptions.map((o) => o.id);
		} else if (code === 'slider') {
			correctAnswer = String(r?.correct_value ?? '');
			correctValue = r?.correct_value ?? undefined;
		} else if (code === 'ordering') {
			correctOrder = r?.ordering ?? [];
			correctAnswer = correctOrder.map((i) => i.item_text).join(' → ');
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
		// A csapatok telefonja minden felfedés után megkapja a köri állást
		// (akkor is, ha a kivetítős állást a host kihagyja).
		await computeStandings();
	}

	// Kahoot-szerű köztes állás: a kör eddigi pontjai alapján (round_leaderboard,
	// minden csapat), holtversenyben azonos helyezéssel. MINDEN felfedés után
	// lefut, így a helyezés-változás és a szerzett pont mindig az előző
	// kérdéshez képest értendő (akkor is, ha a kivetítős állás kimaradt), és
	// a csapatok telefonja round_standings_update-ként megkapja.
	async function computeStandings() {
		const roundId = game.current_round_id;
		if (!roundId) return;
		const { data: rows, error } = await data.supabase.rpc('round_leaderboard', {
			p_round_id: roundId,
			p_limit: 500
		});
		if (error) {
			statusMessage = error.message;
			return;
		}

		const previous = previousStandings?.roundId === roundId ? previousStandings.byTeam : {};
		const standings = rankRows(
			(rows ?? []).map((r) => ({ team_id: r.team_id, name: r.name, score: Number(r.round_score) })),
			previous
		);
		questionStandings = standings;
		previousStandings = {
			roundId,
			byTeam: Object.fromEntries(
				standings.map((r) => [r.team_id, { rank: r.rank, score: r.score }])
			)
		};

		await channel?.send({
			type: 'broadcast',
			event: 'round_standings_update',
			payload: {
				round_id: roundId,
				question_number: currentIndex + 1,
				total_questions: roundQuestions.length,
				standings
			} satisfies RoundStandingsUpdatePayload
		});
	}

	async function revealQuestionStandings() {
		const roundId = game.current_round_id;
		if (!roundId) return;
		if (questionStandings.length === 0) await computeStandings();
		const round = rounds.find((r) => r.id === roundId);
		const payload: QuestionStandingsRevealPayload = {
			round_id: roundId,
			round_title: round?.title ?? '',
			question_number: currentIndex + 1,
			total_questions: roundQuestions.length,
			standings: questionStandings
		};
		await channel?.send({ type: 'broadcast', event: 'question_standings_reveal', payload });
		uiStep = 'question_standings';
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
	// --- Élő lépések és billentyűzet (docs/features/host-keyboard.md) -------
	type Action = { label: string; run: () => Promise<void> | void };

	const hasNextQuestion = $derived(currentIndex + 1 < roundQuestions.length);
	const standingsFirst = $derived(roundQuestions[currentIndex]?.show_standings ?? true);

	// A kiemelt lépés (Space / Enter): mindig az, ami a képernyőn is kiemelt.
	const primary = $derived.by((): Action | null => {
		if (game.status !== 'active' || roundQuestions.length === 0) return null;
		switch (uiStep) {
			case 'idle':
				return hasNextQuestion ? { label: 'Következő kérdés', run: showNextQuestion } : null;
			case 'timing':
				return readingLeft > 0
					? { label: 'Olvasás átugrása', run: skipReading }
					: { label: 'Válaszok lezárása most', run: lockAnswers };
			case 'locked':
				return { label: 'Megoldás feltárása', run: revealAnswer };
			case 'revealed':
				if (hasNextQuestion) {
					return standingsFirst
						? { label: 'Állás a körben', run: revealQuestionStandings }
						: { label: 'Következő kérdés', run: showNextQuestion };
				}
				return nextRoundAfterCurrent()
					? { label: 'Kör eredményének feltárása', run: revealRoundLeaderboard }
					: { label: 'Végeredmény feltárása', run: revealFinalLeaderboard };
			case 'question_standings':
				return hasNextQuestion ? { label: 'Következő kérdés', run: showNextQuestion } : null;
			case 'round_summary':
				return { label: 'Következő kör', run: advanceToNextRound };
			default:
				// A játék lezárásának szándékosan nincs gyorsbillentyűje.
				return null;
		}
	});

	// Másodlagos lépés (S): felfedés után a kiemelt lépés párja.
	const secondary = $derived.by((): Action | null => {
		if (uiStep !== 'revealed' || !hasNextQuestion) return null;
		return standingsFirst
			? { label: 'Következő kérdés (állás nélkül)', run: showNextQuestion }
			: { label: 'Állás a körben', run: revealQuestionStandings };
	});

	async function runAction(action: Action | null) {
		// Dupla lenyomás elleni védelem: futó lépés alatt és 0,8 mp-en belül
		// a második lenyomás nem léptet tovább.
		const now = Date.now();
		if (!action || acting || now - lastActionAt < 800) return;
		lastActionAt = now;
		acting = true;
		try {
			await action.run();
		} finally {
			acting = false;
		}
	}

	const steps = $derived.by(() => {
		const order = ['reading', 'answer', 'reveal', 'standings', 'next'] as const;
		const current =
			uiStep === 'timing'
				? readingLeft > 0
					? 'reading'
					: 'answer'
				: uiStep === 'locked'
					? 'answer'
					: uiStep === 'revealed'
						? 'reveal'
						: uiStep === 'question_standings'
							? 'standings'
							: 'next';
		const labels: Record<(typeof order)[number], [string, string]> = {
			reading: [
				'Olvasás',
				timerInfo?.reading_seconds
					? `${timerInfo.reading_seconds} mp · Space átugorja`
					: 'csak a kérdés'
			],
			answer: ['Válaszidő', `${currentQuestion?.time_limit_seconds ?? '–'} mp`],
			reveal: ['Felfedés', 'helyes válasz'],
			standings: [
				'Állás a körben',
				standingsFirst ? 'alapból igen · S kihagyja' : 'alapból kihagyva'
			],
			next: ['Következő', hasNextQuestion ? 'kérdés' : 'kör vége']
		};
		const at = order.indexOf(current);
		return order.map((key, i) => ({
			key,
			label: labels[key][0],
			sub: labels[key][1],
			state: i < at ? 'done' : i === at ? 'current' : 'next'
		}));
	});

	function isTyping(el: EventTarget | null) {
		if (!(el instanceof HTMLElement)) return false;
		if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
		return (
			el.tagName === 'INPUT' &&
			!['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)
		);
	}

	function onKeydown(e: KeyboardEvent) {
		if (game.status !== 'active' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey)
			return;
		if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
		const key = e.key;
		const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
		if (key === ' ' || (key === 'Enter' && !onButton)) {
			e.preventDefault();
			void runAction(primary);
		} else if (key === 's' || key === 'S') {
			e.preventDefault();
			if (uiStep === 'revealed' && standingsFirst) void runAction(secondary);
		} else if (key === 'l' || key === 'L') {
			e.preventDefault();
			if (uiStep === 'timing' && readingLeft === 0) void runAction({ label: '', run: lockAnswers });
		} else if (key === 'm' || key === 'M') {
			e.preventDefault();
			void toggleTvSound();
		} else if ((key === 'c' || key === 'C') && game.join_requires_code) {
			e.preventDefault();
			codesOpen = !codesOpen;
		} else if (key === '?') {
			e.preventDefault();
			helpOpen = true;
		}
	}

	const shortcutGroups: ShortcutGroup[] = [
		{
			title: 'Lebonyolítás',
			items: [
				{ label: 'Kiemelt lépés (tovább)', keys: ['Space'] },
				{ label: 'Ugyanez', keys: ['Enter'] },
				{ label: 'Állás kihagyása, következő kérdés', keys: ['S'] },
				{ label: 'Válaszok lezárása azonnal', keys: ['L'] }
			]
		},
		{
			title: 'Egyéb',
			items: [
				{ label: 'Kivetítő hang ki / be', keys: ['M'] },
				{ label: 'Csapatkódok (késve érkezőknek)', keys: ['C'] },
				{ label: 'Ez a súgó', keys: ['?'] },
				{ label: 'Ablak bezárása', keys: ['Esc'] }
			]
		}
	];
</script>

<svelte:head>
	<title>{game.title} — Host</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<ShortcutHelp
	bind:open={helpOpen}
	title="Billentyűparancsok · élő lebonyolítás"
	note="A Space mindig a kiemelt gombot nyomja meg: indítás → olvasás átugrása → lezárás → felfedés → állás → következő kérdés."
	groups={shortcutGroups}
/>

<main
	class="cabinet"
	class:lobby={game.status === 'lobby'}
	class:live-mode={game.status === 'active'}
	style={theme.css}
>
	{#if statusMessage}
		<p class="status-message">{statusMessage}</p>
	{/if}

	{#if game.status === 'lobby'}
		<!-- Élő tesztből: a lobby görgetést igényelt — széles kijelzőn két
		     oszlop (PIN/QR | vezérlők + csapatok), hogy egy nézetben elférjen. -->
		<div class="lobby-grid">
			<div data-tour="hl-pin"><PinDisplay pin={game.pin} {qrDataUrl} {joinUrl} /></div>

			<div class="lobby-side">
				<div class="theme-picker" data-tour="hl-theme">
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
					<span data-tour="hl-start"><Button onclick={startGame}>Kvíz indítása</Button></span>
					<span data-tour="hl-tv">
						<Button
							variant="secondary"
							href={resolve('/tv/[game_id]', { game_id: game.id })}
							target="_blank"
							rel="noopener"
						>
							Kivetítő megnyitása (TV mód) →
						</Button>
					</span>
				</div>

				{#if game.join_requires_code}
					<div data-tour="hl-codes">
						<JoinCodesPanel supabase={data.supabase} gameId={game.id} refreshKey={teams.length} />
					</div>
				{/if}

				<div data-tour="hl-teams">
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
				</div>
			</div>
		</div>
	{:else if game.status === 'active' && roundQuestions.length === 0}
		<p class="loading">Kérdések betöltése…</p>
	{:else if game.status === 'active'}
		<div class="live">
			<div class="live-main">
				<ol class="steps" aria-label="A kérdés lépései" data-tour="hlv-steps">
					{#each steps as step, i (step.key)}
						<li
							class="step {step.state}"
							aria-current={step.state === 'current' ? 'step' : undefined}
						>
							<span class="step-n">{i + 1}. lépés</span>
							<span class="step-label">{step.label}</span>
							<span class="step-sub">{step.sub}</span>
						</li>
					{/each}
				</ol>

				<p class="round-label">
					{rounds.find((r) => r.id === game.current_round_id)?.title}
					{#if roundQuestions[currentIndex]}· {currentIndex + 1}. kérdés / {roundQuestions.length}{/if}
				</p>

				<div class="question-row">
					{#if roundQuestions[currentIndex]}
						<div class="question-box" data-tour="hlv-question">
							<ArcadePanel>
								<p class="progress">A kivetítőn most</p>
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
										{#if roundQuestions[currentIndex].image_pixelate}
											<p class="pixel-note">
												A csapatok pixelesen látják, a visszaszámlálás alatt élesedik.
											</p>
										{/if}
									{/if}
								{/key}
							</ArcadePanel>
						</div>
					{/if}

					{#if uiStep === 'timing' || uiStep === 'locked'}
						<div class="timer-box" data-tour="hlv-timer">
							{#if uiStep === 'locked'}
								<p class="locked-label">Lezárva</p>
							{:else if readingLeft > 0}
								<span class="timer-caption">Olvasás</span>
								<span class="reading-count">{readingLeft}</span>
								<span class="timer-caption">utána {timerInfo?.duration ?? 0} mp válaszidő</span>
							{:else}
								<span class="timer-caption">Válaszidő</span>
								<TimerRing {secondsLeft} duration={timerInfo?.duration ?? 0} />
							{/if}
							<span class="timer-caption" data-tour="hlv-submissions"
								>{submissionCount} / {teams.length} csapat válaszolt</span
							>
						</div>
					{:else}
						<p class="submissions" data-tour="hlv-submissions">
							Beérkezett válaszok: {submissionCount} / {teams.length}
						</p>
					{/if}
				</div>

				<!-- Fázis Q6 — a host saját maga tájékozódására: kis előnézet az
				     opciók képeiről is, ha vannak. -->
				{#if currentQuestion?.options?.some((o) => o.image_url)}
					<div class="host-option-previews">
						{#each currentQuestion.options ?? [] as option (option.id)}
							{#if option.image_url}
								<img
									class="host-image-preview small"
									src={option.image_url}
									alt={option.option_text}
								/>
							{/if}
						{/each}
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

				<div class="controls" data-tour="hlv-controls">
					{#if primary}
						<button
							type="button"
							class="primary-action"
							disabled={acting}
							data-tour={uiStep === 'revealed' && standingsFirst ? 'hlv-standings' : undefined}
							onclick={() => runAction(primary)}
						>
							{primary.label}
							<kbd>Space</kbd>
						</button>
					{/if}
					{#if secondary}
						<button
							type="button"
							class="secondary-action"
							disabled={acting}
							data-tour={uiStep === 'revealed' && !standingsFirst ? 'hlv-standings' : undefined}
							onclick={() => runAction(secondary)}
						>
							{secondary.label}
							{#if standingsFirst}<kbd>S</kbd>{/if}
						</button>
					{/if}
					{#if uiStep === 'timing' && readingLeft === 0}
						<span class="hint">Lejártakor automatikusan lezár és feltár.</span>
					{/if}
				</div>

				{#if uiStep === 'question_standings'}
					<div class="leaderboard" in:fade={{ duration: 200 }}>
						<h3>Állás a körben — {currentIndex + 1}. kérdés után</h3>
						<StandingsBoard rows={questionStandings} limit={10} />
					</div>
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

				<div data-tour="hlv-teams" class="teams-block">
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
				</div>
			</div>

			<aside class="live-side" aria-label="Élő billentyűparancsok" data-tour="hlv-keys">
				<button type="button" class="sound-chip" aria-pressed={!tvMuted} onclick={toggleTvSound}>
					<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
						><path d="M4 9v6h4l5 4V5L8 9H4z" />{#if !tvMuted}<path
								d="M16 9a4 4 0 0 1 0 6"
							/>{:else}<path d="M17 9l5 6M22 9l-5 6" />{/if}</svg
					>
					{tvMuted ? 'Kivetítő némítva' : 'Hang: csak a kivetítőn'}
					<kbd>M</kbd>
				</button>
				<h3>Élő billentyűparancsok</h3>
				{#each shortcutGroups as group (group.title)}
					{#each group.items as item (item.label)}
						<div class="key-row">
							<span>{item.label}</span>
							<span class="keys"
								>{#each item.keys as k (k)}<kbd>{k}</kbd>{/each}</span
							>
						</div>
					{/each}
				{/each}
				<p class="safety">
					A játék lezárásának nincs gyorsbillentyűje — csak gombbal. Dupla lenyomás ellen 0,8 mp-es
					védelem.
				</p>
				{#if game.join_requires_code}
					<button type="button" class="codes-toggle" onclick={() => (codesOpen = !codesOpen)}
						>{codesOpen ? 'Csapatkódok elrejtése' : 'Csapatkódok (késve érkezőknek)'}
						<kbd>C</kbd></button
					>
					{#if codesOpen}
						<JoinCodesPanel supabase={data.supabase} gameId={game.id} refreshKey={teams.length} />
					{/if}
				{/if}
			</aside>
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

	main.cabinet.lobby {
		max-width: 60rem;
		padding-top: clamp(1rem, 3vh, 2rem);
		padding-bottom: clamp(1rem, 3vh, 2rem);
	}

	.lobby-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(0.75rem, 2vh, 1.5rem);
	}

	.lobby-side {
		width: 100%;
		max-width: 22rem;
	}

	.lobby-side h2 {
		margin: clamp(0.5rem, 2vh, 1rem) 0 0.5rem;
	}

	@media (min-width: 860px) {
		.lobby-grid {
			flex-direction: row;
			justify-content: center;
			align-items: center;
			gap: 3rem;
		}
	}

	.theme-picker {
		max-width: 16rem;
		margin: 0 auto clamp(0.75rem, 2vh, 1.5rem);
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.round-label {
		font-weight: bold;
		margin: 1rem 0 0.5rem;
		color: var(--power);
	}

	main.cabinet.live-mode {
		max-width: 76rem;
		text-align: left;
	}

	.live {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		gap: 1.5rem;
		align-items: start;
	}

	.live-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.55rem 0.7rem;
		border-radius: 0.6rem;
		border: var(--panel-border-width, 1px) solid var(--panel-border, var(--cabinet-3));
		background: var(--cabinet-2);
		color: var(--marquee-dim);
		min-width: 0;
	}

	.step.done {
		background: var(--cabinet-3);
	}

	.step.current {
		border-color: transparent;
		background: var(--btn-primary, var(--cyan));
		color: var(--on-primary, var(--cabinet));
	}

	.step-n {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.step-label {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.step-sub {
		font-size: 0.75rem;
		opacity: 0.85;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.question-row {
		display: flex;
		gap: 1rem;
		align-items: stretch;
	}

	.question-box {
		flex: 1;
		min-width: 0;
	}

	.timer-box {
		width: 13rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 1rem;
		border-radius: 1rem;
		background: var(--cabinet-2);
		border: var(--panel-border-width, 1px) solid var(--panel-border, var(--cabinet-3));
		text-align: center;
	}

	.timer-caption {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.reading-count {
		font-family: var(--font-display);
		font-size: 3.5rem;
		line-height: 1;
		color: var(--cyan);
	}

	.primary-action,
	.secondary-action {
		display: inline-flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 3.5rem;
		padding: 0 1.4rem;
		border-radius: 0.8rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-action {
		border: 0;
		background: var(--btn-primary, var(--cyan));
		color: var(--on-primary, var(--cabinet));
		font-size: 1.15rem;
	}

	.secondary-action {
		border: var(--field-border-width, 2px) solid var(--field-border, var(--marquee-dim));
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.primary-action:disabled,
	.secondary-action:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.primary-action:focus-visible,
	.secondary-action:focus-visible,
	.sound-chip:focus-visible,
	.codes-toggle:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.primary-action kbd,
	.secondary-action kbd {
		padding: 0.15rem 0.5rem;
		border-radius: 0.35rem;
		background: color-mix(in srgb, currentColor 18%, transparent);
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}

	.hint {
		align-self: center;
		font-size: 0.85rem;
		color: var(--marquee-dim);
	}

	.live-side {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1rem;
		border-radius: 1rem;
		background: var(--cabinet-2);
		border: var(--panel-border-width, 1px) solid var(--panel-border, var(--cabinet-3));
		font-size: 0.88rem;
	}

	.live-side h3 {
		margin: 0.4rem 0 0.2rem;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cyan);
	}

	.key-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.keys {
		display: flex;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.live-side kbd {
		min-width: 1.5rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--field-border, var(--marquee-dim));
		border-bottom-width: 3px;
		border-radius: 0.35rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		text-align: center;
	}

	.sound-chip,
	.codes-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.3rem 0.8rem;
		border: var(--field-border-width, 1px) solid var(--field-border, var(--marquee-dim));
		border-radius: 999px;
		background: var(--cabinet);
		color: var(--marquee);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.sound-chip svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.sound-chip[aria-pressed='false'] {
		color: var(--danger);
	}

	.sound-chip kbd,
	.codes-toggle kbd {
		margin-left: auto;
	}

	.safety {
		margin: 0.3rem 0 0;
		padding: 0.6rem 0.7rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--coin) 14%, var(--cabinet-2));
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.teams-block {
		margin-top: 0.5rem;
	}

	.teams-block .team-list {
		justify-content: flex-start;
	}

	@media (max-width: 900px) {
		.live {
			grid-template-columns: minmax(0, 1fr);
		}

		.steps {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.question-row {
			flex-direction: column;
		}

		.timer-box {
			width: auto;
		}
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
		border: var(--field-border-width, 2px) solid var(--field-border, var(--marquee-dim));
		margin: 0 auto;
		display: block;
	}

	.pixel-note {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--marquee-dim);
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
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.75rem 0;
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
