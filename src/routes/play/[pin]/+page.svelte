<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import type {
		JokerActivatePayload,
		QuestionRevealPayload,
		QuestionShowPayload,
		TimerStartPayload,
		RoundLeaderboardRevealPayload,
		FinalLeaderboardRevealPayload
	} from '$lib/realtime/protocol';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type JoinedInfo = { teamId: string; teamName: string; gameId: string };

	let storageKey = $derived(`equacards:team:${data.pin}`);

	let joined = $state<JoinedInfo | null>(null);
	let deviceToken = $state('');
	let gameTitle = $state(untrack(() => data.game?.title ?? ''));

	let currentQuestion = $state<QuestionShowPayload | null>(null);
	let timerInfo = $state<TimerStartPayload | null>(null);
	let secondsLeft = $state(0);
	let locked = $state(false);
	let revealInfo = $state<QuestionRevealPayload | null>(null);
	let myResult = $state<{ is_correct: boolean; points_awarded: number } | null>(null);
	let roundLeaderboard = $state<RoundLeaderboardRevealPayload | null>(null);
	let finalLeaderboard = $state<FinalLeaderboardRevealPayload | null>(null);
	let submitted = $state(false);
	let submitError = $state('');
	let jokerUsed = $state(false);

	let selectedOptionId = $state<string | null>(null);
	let selectedOptionIds = $state<string[]>([]);
	let sliderValue = $state(0);
	let orderedItems = $state<{ id: string; item_text: string }[]>([]);
	let dragIndex = $state<number | null>(null);

	let channel: ReturnType<typeof data.supabase.channel> | undefined;

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
			gameTitle = form.game.title;
		}
	});

	// A szerver-oldali load csak 'lobby' állapotú games sort ad vissza (azt
	// dönti el, felajánlható-e az ÚJ csatlakozás) — egy már csatlakozott
	// csapatnak (localStorage alapján) viszont a kliens oldalon, bármilyen
	// nem 'finished' állapotra újra le kell tudnia kérdezni az este címét,
	// különben egy oldal-újratöltés (pl. háttérbe került mobil böngészőlap)
	// után "nem található" hibát látna, holott már csatlakozott.
	$effect(() => {
		if (data.game || !joined) return;
		data.supabase
			.from('games')
			.select('title')
			.eq('id', joined.gameId)
			.single()
			.then(({ data: g }) => {
				if (g) gameTitle = g.title;
			});
	});

	function resetAnswerState(payload: QuestionShowPayload) {
		selectedOptionId = null;
		selectedOptionIds = [];
		sliderValue = payload.slider
			? Math.round((payload.slider.min_value + payload.slider.max_value) / 2)
			: 0;
		orderedItems = payload.ordering_items ? [...payload.ordering_items] : [];
		locked = false;
		revealInfo = null;
		myResult = null;
		roundLeaderboard = null;
		submitted = false;
		submitError = '';
		timerInfo = null;
	}

	async function checkJokerUsed(teamId: string) {
		const { data: uses } = await data.supabase
			.from('team_joker_uses')
			.select('id')
			.eq('team_id', teamId)
			.eq('joker_type', 'double_points')
			.maybeSingle();
		jokerUsed = !!uses;
	}

	// Presence: a host lobby nézete ezen keresztül látja, mely csapatok vannak
	// éppen élőben csatlakozva. A `team_joined` broadcast egy egyszeri
	// értesítés is ugyanazon a csatornán — lásd docs/architecture/REALTIME_PROTOCOL.md.
	$effect(() => {
		const info = joined;
		if (!info) return;

		checkJokerUsed(info.teamId);

		channel = data.supabase.channel(`game:${info.gameId}`, {
			config: { presence: { key: info.teamId } }
		});

		channel.on('broadcast', { event: 'question_show' }, ({ payload }) => {
			currentQuestion = payload as QuestionShowPayload;
			resetAnswerState(currentQuestion);
		});

		channel.on('broadcast', { event: 'timer_start' }, ({ payload }) => {
			timerInfo = payload as TimerStartPayload;
		});

		channel.on('broadcast', { event: 'answer_locked' }, () => {
			locked = true;
		});

		channel.on('broadcast', { event: 'question_reveal' }, ({ payload }) => {
			const reveal = payload as QuestionRevealPayload;
			revealInfo = reveal;
			locked = true;

			// A csapatok pontja szándékosan nincs benne a broadcastban (mindenki
			// ugyanazt a csatornát hallgatja) — a saját pontot egy külön,
			// team_id + question_id paraméterezésű RPC-vel kérdezzük le, ami csak
			// egyetlen sort ad vissza. Lásd docs/architecture/REALTIME_PROTOCOL.md.
			data.supabase
				.rpc('team_answer_result', {
					p_team_id: info.teamId,
					p_question_id: reveal.question_id
				})
				.then(({ data: rows }) => {
					myResult = rows?.[0] ?? null;
				});
		});

		channel.on('broadcast', { event: 'round_leaderboard_reveal' }, ({ payload }) => {
			roundLeaderboard = payload as RoundLeaderboardRevealPayload;
		});

		channel.on('broadcast', { event: 'final_leaderboard_reveal' }, ({ payload }) => {
			finalLeaderboard = payload as FinalLeaderboardRevealPayload;
		});

		channel.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await channel!.track({ team_id: info.teamId, name: info.teamName });
				await channel!.send({
					type: 'broadcast',
					event: 'team_joined',
					payload: { team_id: info.teamId, name: info.teamName }
				});
			}
		});

		return () => {
			channel?.unsubscribe();
		};
	});

	// Helyi visszaszámlálás a timer_start szerver-időbélyege alapján — ha lejár,
	// a csapat kliense saját magát zárja le (nem kell megvárni egy külön
	// answer_locked broadcastot).
	$effect(() => {
		if (!timerInfo) return;
		const endTime = new Date(timerInfo.server_start_time).getTime() + timerInfo.duration * 1000;

		const tick = () => {
			const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
			secondsLeft = remaining;
			if (remaining <= 0) {
				locked = true;
			}
		};
		tick();
		const interval = setInterval(tick, 250);
		return () => clearInterval(interval);
	});

	function toggleMultiOption(id: string) {
		if (selectedOptionIds.includes(id)) {
			selectedOptionIds = selectedOptionIds.filter((x) => x !== id);
		} else {
			selectedOptionIds = [...selectedOptionIds, id];
		}
	}

	function reorder(from: number | null, to: number) {
		if (from === null || from === to) return;
		const copy = [...orderedItems];
		const [moved] = copy.splice(from, 1);
		copy.splice(to, 0, moved);
		orderedItems = copy;
		dragIndex = null;
	}

	async function submitAnswer() {
		if (!currentQuestion || !joined || submitted) return;

		const answerId = crypto.randomUUID();
		const { error: answerError } = await data.supabase.from('answers').insert({
			id: answerId,
			game_id: joined.gameId,
			question_id: currentQuestion.question_id,
			team_id: joined.teamId,
			answer_time_ms: timerInfo
				? Date.now() - new Date(timerInfo.server_start_time).getTime()
				: null
		});

		if (answerError) {
			submitError = 'Nem sikerült elküldeni a választ, próbáld újra.';
			return;
		}

		if (
			currentQuestion.question_type === 'single_choice' ||
			currentQuestion.question_type === 'true_false'
		) {
			if (selectedOptionId) {
				await data.supabase
					.from('answer_choice')
					.insert({ answer_id: answerId, option_id: selectedOptionId });
			}
		} else if (currentQuestion.question_type === 'multi_choice') {
			if (selectedOptionIds.length) {
				await data.supabase
					.from('answer_choice_multi')
					.insert(selectedOptionIds.map((option_id) => ({ answer_id: answerId, option_id })));
			}
		} else if (currentQuestion.question_type === 'slider') {
			await data.supabase.from('answer_slider').insert({ answer_id: answerId, value: sliderValue });
		} else if (currentQuestion.question_type === 'ordering') {
			await data.supabase.from('answer_ordering').insert(
				orderedItems.map((item, i) => ({
					answer_id: answerId,
					item_id: item.id,
					position: i + 1
				}))
			);
		}

		submitted = true;
	}

	async function activateJoker() {
		if (!joined || !currentQuestion || jokerUsed || locked) return;
		jokerUsed = true;
		await channel?.send({
			type: 'broadcast',
			event: 'joker_activate',
			payload: {
				team_id: joined.teamId,
				question_id: currentQuestion.question_id,
				joker_type: 'double_points'
			} satisfies JokerActivatePayload
		});
	}
</script>

<svelte:head>
	<title>{gameTitle || 'Csatlakozás'} — EquaCards</title>
</svelte:head>

<main>
	{#if joined}
		<h1>{gameTitle}</h1>

		{#if finalLeaderboard}
			<div class="leaderboard">
				<h2>Végeredmény</h2>
				<ol>
					{#each finalLeaderboard.standings as row (row.team_id)}
						<li class:own={row.team_id === joined.teamId}>
							{row.name} — {row.total_score} pont
						</li>
					{/each}
				</ol>
			</div>
		{:else if roundLeaderboard}
			<div class="leaderboard">
				<h2>{roundLeaderboard.round_title} — Top 3</h2>
				<ol>
					{#each roundLeaderboard.top3 as row (row.team_id)}
						<li class:own={row.team_id === joined.teamId}>
							{row.name} — {row.round_score} pont
						</li>
					{/each}
				</ol>
				<p>Várj a következő körre…</p>
			</div>
		{:else if revealInfo}
			<div class="reveal">
				<p>Helyes válasz: <strong>{revealInfo.correct_answer}</strong></p>
				{#if myResult}
					<p class:correct={myResult.is_correct} class:incorrect={!myResult.is_correct}>
						{myResult.is_correct ? 'Eltaláltad!' : 'Nem talált.'} +{myResult.points_awarded} pont
					</p>
				{:else}
					<p>{submitted ? 'A válaszod elküldve.' : 'Nem küldtél választ időben.'}</p>
				{/if}
			</div>
		{:else if currentQuestion}
			<p class="round-title">
				{currentQuestion.round_title} — {currentQuestion.order_index}/{currentQuestion.total_questions}
			</p>
			<p class="prompt">{currentQuestion.prompt}</p>
			{#if timerInfo}<p class="timer">{secondsLeft}s</p>{/if}

			{#if submitted}
				<p>Válasz elküldve, várj a többiekre…</p>
			{:else if locked}
				<p>Az idő lejárt.</p>
			{:else}
				{#if currentQuestion.question_type === 'single_choice' || currentQuestion.question_type === 'true_false'}
					<div class="options">
						{#each currentQuestion.options ?? [] as option (option.id)}
							<button
								type="button"
								class="option"
								class:selected={selectedOptionId === option.id}
								onclick={() => (selectedOptionId = option.id)}
							>
								{option.option_text}
							</button>
						{/each}
					</div>
				{:else if currentQuestion.question_type === 'multi_choice'}
					<div class="options">
						{#each currentQuestion.options ?? [] as option (option.id)}
							<button
								type="button"
								class="option"
								class:selected={selectedOptionIds.includes(option.id)}
								onclick={() => toggleMultiOption(option.id)}
							>
								{option.option_text}
							</button>
						{/each}
					</div>
				{:else if currentQuestion.question_type === 'slider'}
					<div class="slider">
						<input
							type="range"
							min={currentQuestion.slider?.min_value}
							max={currentQuestion.slider?.max_value}
							step={currentQuestion.slider?.step}
							bind:value={sliderValue}
						/>
						<p class="slider-value">{sliderValue}</p>
					</div>
				{:else if currentQuestion.question_type === 'ordering'}
					<ol class="ordering">
						{#each orderedItems as item, i (item.id)}
							<li
								draggable="true"
								ondragstart={() => (dragIndex = i)}
								ondragover={(e) => e.preventDefault()}
								ondrop={() => reorder(dragIndex, i)}
							>
								{item.item_text}
							</li>
						{/each}
					</ol>
				{/if}

				{#if submitError}
					<p class="error">{submitError}</p>
				{/if}

				<button type="button" onclick={submitAnswer}>Válasz elküldése</button>

				{#if !jokerUsed}
					<button type="button" class="joker" onclick={activateJoker}>Duplázás 🃏</button>
				{/if}
			{/if}
		{:else}
			<p>Csatlakoztál csapatként: <strong>{joined.teamName}</strong></p>
			<p>Várj, amíg a kvízmester elindítja a játékot…</p>
		{/if}
	{:else if data.game}
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
	{:else}
		<h1>Nem található</h1>
		<p>A PIN nem található, vagy a játék már elindult.</p>
		<a href={resolve('/play')}>Vissza</a>
	{/if}
</main>

<style>
	main {
		max-width: 24rem;
		margin: 3rem auto;
		text-align: center;
		padding: 0 1rem;
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

	.round-title {
		color: #666;
		font-size: 0.875rem;
	}

	.prompt {
		font-size: 1.25rem;
		margin: 1rem 0;
	}

	.timer {
		font-size: 2rem;
		font-weight: bold;
	}

	.options {
		display: grid;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.option {
		padding: 0.75rem;
		border: 2px solid #ccc;
		border-radius: 0.5rem;
		background: white;
		cursor: pointer;
	}

	.option.selected {
		border-color: #2563eb;
		background: #eff6ff;
	}

	.slider {
		margin: 1.5rem 0;
	}

	.slider-value {
		font-size: 1.5rem;
		font-weight: bold;
	}

	.ordering {
		list-style: decimal;
		text-align: left;
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.ordering li {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 0.25rem;
		margin-bottom: 0.25rem;
		background: white;
		cursor: grab;
	}

	.joker {
		margin-top: 0.75rem;
		background: #fef3c7;
		border: 2px solid #f59e0b;
	}

	.leaderboard ol {
		list-style: decimal;
		text-align: left;
		padding-left: 1.5rem;
		margin: 1rem 0;
	}

	.leaderboard li.own {
		font-weight: bold;
		color: #2563eb;
	}

	.correct {
		color: #15803d;
		font-weight: bold;
	}

	.incorrect {
		color: #b91c1c;
		font-weight: bold;
	}

	.error {
		color: #b91c1c;
	}
</style>
