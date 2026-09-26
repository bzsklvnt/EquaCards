<script lang="ts">
	import { resolve } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ReopenGameButton from '$lib/components/ReopenGameButton.svelte';
	import TourButton from '$lib/components/TourButton.svelte';
	import ShortcutHelp, { type ShortcutGroup } from '$lib/components/ShortcutHelp.svelte';
	import QuestionCanvas from '$lib/builder/QuestionCanvas.svelte';
	import QuestionSettings from '$lib/builder/QuestionSettings.svelte';
	import QuestionPreview from '$lib/builder/QuestionPreview.svelte';
	import BankDrawer from '$lib/builder/BankDrawer.svelte';
	import BuilderOverview from '$lib/builder/BuilderOverview.svelte';
	import { computeIssues, type BuilderRound } from '$lib/builder/issues';
	import {
		convertDraft,
		draftError,
		draftSignature,
		effectiveReading,
		emptyDraft,
		newLocalKey,
		TYPE_ORDER,
		TYPE_SHORT,
		type BankItem,
		type Draft
	} from '$lib/builder/model';
	import { registerPageTour, tourState } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	// Kvízösszerakó — docs/features/quiz-builder.md. A kliens a szerkesztés
	// "igazság-forrása": a kérdések piszkozatként élnek itt, és a
	// ./builder végponton automatikusan mentődnek, amint érvényesek.

	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'game-setup');

	// A kezdőállapot egyszer, a betöltött adatokból épül; utána a kliens az
	// igazság-forrása (a data újratöltése — pl. újranyitás után — nem írja felül).
	const initial = untrack(() => data);
	const gameId = initial.game.id;
	const types = initial.questionTypes;

	// --- Állapot ---------------------------------------------------------
	let drafts = $state<Record<string, Draft>>(
		Object.fromEntries(initial.drafts.map((d) => [d.key, d]))
	);
	let savedSig = $state<Record<string, string>>(
		Object.fromEntries(initial.drafts.map((d) => [d.key, draftSignature(d)]))
	);
	const initialRounds: BuilderRound[] = initial.rounds.map((r) => ({
		id: r.id,
		title: r.title,
		keys: [...r.questionIds]
	}));
	let rounds = $state<BuilderRound[]>(initialRounds);
	let hidden = $state<Record<string, boolean>>(
		Object.fromEntries(
			initial.rounds.flatMap((r) => r.hiddenStandings.map((q) => [`${r.id}:${q}`, true]))
		)
	);
	let bank = $state<BankItem[]>(initial.bank);
	let selected = $state<{ roundId: string; key: string | null } | null>(
		initialRounds[0]
			? { roundId: initialRounds[0].id, key: initialRounds[0].keys[0] ?? null }
			: null
	);
	let view = $state<'editor' | 'overview'>('editor');
	let bankOpen = $state(false);
	let helpOpen = $state(false);
	let previewOpen = $state(false);
	let busy = $state(false);
	let saving = $state<Record<string, boolean>>({});
	let saveErrors = $state<Record<string, string>>({});
	let canvas = $state<ReturnType<typeof QuestionCanvas>>();
	let overview = $state<ReturnType<typeof BuilderOverview>>();
	let previewDialog = $state<HTMLDialogElement>();
	let newRoundTitle = $state('');
	let newRoundInput = $state<HTMLInputElement>();
	let renamingRound = $state<string | null>(null);
	let collapsed = $state<Record<string, boolean>>({});

	const currentRound = $derived(rounds.find((r) => r.id === selected?.roundId) ?? null);
	const currentKey = $derived(selected?.key ?? null);
	const currentDraft = $derived(currentKey ? drafts[currentKey] : undefined);
	const currentIndex = $derived(
		currentRound && currentKey ? currentRound.keys.indexOf(currentKey) : -1
	);
	const currentRoundIndex = $derived(rounds.findIndex((r) => r.id === selected?.roundId));
	const playedCount = (id: string) => bank.find((b) => b.id === id)?.played_count ?? 0;
	const isDirty = (key: string) => {
		const d = drafts[key];
		return !!d && (d.id === null || draftSignature(d) !== savedSig[key]);
	};
	const issues = $derived(
		computeIssues(rounds, drafts, types, playedCount, (k) => !!saving[k] || isDirty(k))
	);
	const errorCount = $derived(issues.filter((i) => i.level === 'error').length);
	const anySaving = $derived(Object.values(saving).some(Boolean));
	const unsavedKeys = $derived(
		rounds.flatMap((r) => r.keys).filter((k) => isDirty(k) && !saving[k])
	);
	const currentError = $derived(currentDraft ? draftError(currentDraft, types) : null);

	// --- API ---------------------------------------------------------------
	async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
		const res = await fetch(resolve('/admin/games/[id]/builder', { id: gameId }), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = (await res.json().catch(() => ({}))) as T & {
			error?: string;
			message?: string;
		};
		if (!res.ok) throw new Error(payload.error ?? payload.message ?? 'Nem sikerült a művelet.');
		if (payload.error) toast.warning(payload.error);
		return payload;
	}

	const idsOf = (keys: string[]) =>
		keys.map((k) => drafts[k]?.id).filter((id): id is string => !!id);

	async function persistRound(roundId: string) {
		const round = rounds.find((r) => r.id === roundId);
		if (!round) return;
		try {
			await api({ op: 'setRound', round_id: roundId, question_ids: idsOf(round.keys) });
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	// --- Automatikus mentés -------------------------------------------------
	// Szándékosan nem reaktív: belső időzítő- és újramentés-nyilvántartás.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const resave = new Set<string>();

	function schedule(key: string, delay = 700) {
		clearTimeout(timers.get(key));
		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key);
				void save(key);
			}, delay)
		);
	}

	function flush(key: string | null) {
		if (!key || !timers.has(key)) return;
		clearTimeout(timers.get(key));
		timers.delete(key);
		void save(key);
	}

	function rekey(oldKey: string, newKey: string) {
		if (oldKey === newKey) return;
		drafts[newKey] = { ...drafts[oldKey], key: newKey };
		delete drafts[oldKey];
		savedSig[newKey] = savedSig[oldKey];
		delete savedSig[oldKey];
		for (const r of rounds) r.keys = r.keys.map((k) => (k === oldKey ? newKey : k));
		if (selected?.key === oldKey) selected = { ...selected, key: newKey };
		if (saveErrors[oldKey]) {
			saveErrors[newKey] = saveErrors[oldKey];
			delete saveErrors[oldKey];
		}
	}

	async function save(key: string) {
		const draft = drafts[key];
		if (!draft) return;
		const error = draftError(draft, types);
		if (error) {
			saveErrors[key] = error;
			return;
		}
		if (saving[key]) {
			resave.add(key);
			return;
		}
		const snapshot = $state.snapshot(draft) as Draft;
		const sig = draftSignature(snapshot);
		if (snapshot.id && sig === savedSig[key]) return;
		saving[key] = true;
		const round = rounds.find((r) => r.keys.includes(key));
		try {
			const body: Record<string, unknown> = { op: 'save', draft: snapshot };
			if (!snapshot.id && round) {
				body.round_id = round.id;
				body.order = round.keys
					.map((k) => (k === key ? '__new__' : drafts[k]?.id))
					.filter((x): x is string => !!x);
			}
			const res = await api<{ id: string }>(body);
			delete saveErrors[key];
			let liveKey = key;
			if (!snapshot.id) {
				drafts[key].id = res.id;
				savedSig[key] = sig;
				rekey(key, res.id);
				liveKey = res.id;
				bank = [
					{
						id: res.id,
						prompt: snapshot.prompt,
						theme_id: snapshot.theme_id,
						type_code: snapshot.type_code,
						has_image: !!snapshot.image_url,
						created_at: new Date().toISOString(),
						played_count: 0,
						played_last: null
					},
					...bank
				];
			} else {
				savedSig[key] = sig;
				bank = bank.map((b) =>
					b.id === snapshot.id
						? {
								...b,
								prompt: snapshot.prompt,
								type_code: snapshot.type_code,
								theme_id: snapshot.theme_id,
								has_image: !!snapshot.image_url
							}
						: b
				);
			}
			saving[key] = false;
			delete saving[key];
			const live = drafts[liveKey];
			if (resave.delete(key) || (live && draftSignature(live) !== savedSig[liveKey])) {
				schedule(liveKey, 300);
			}
		} catch (err) {
			saving[key] = false;
			delete saving[key];
			saveErrors[key] = (err as Error).message;
			toast.error(`Mentés sikertelen: ${(err as Error).message}`);
		}
	}

	// A kijelölt kérdés változásait figyeli és ütemezi a mentést.
	$effect(() => {
		const key = currentKey;
		if (!key) return;
		const d = drafts[key];
		if (!d) return;
		const sig = draftSignature(d);
		if (d.id && sig === savedSig[key]) return;
		if (draftError(d, types)) {
			clearTimeout(timers.get(key));
			timers.delete(key);
			return;
		}
		schedule(key);
	});

	function flushAll() {
		for (const key of [...timers.keys()]) flush(key);
	}

	beforeNavigate(({ cancel, type }) => {
		flushAll();
		if (type !== 'leave' && unsavedKeys.some((k) => draftError(drafts[k], types))) {
			if (!confirm('Van mentetlen (hiányos) kérdés. Biztosan elhagyod az oldalt?')) cancel();
		}
	});

	onMount(() => {
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			flushAll();
			if (unsavedKeys.length > 0 || anySaving) e.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	// --- Kijelölés, navigáció -------------------------------------------------
	function select(roundId: string, key: string | null, focus = false) {
		if (selected?.key && selected.key !== key) flush(selected.key);
		selected = { roundId, key };
		if (focus) void focusRailItem();
	}

	async function focusRailItem() {
		await tick();
		const el = document.querySelector<HTMLElement>(
			`[data-rail-key="${selected?.roundId}:${selected?.key}"]`
		);
		el?.focus();
		el?.scrollIntoView({ block: 'nearest' });
	}

	const flat = $derived(rounds.flatMap((r) => r.keys.map((key) => ({ roundId: r.id, key }))));

	function step(delta: number) {
		if (flat.length === 0) return;
		const i = flat.findIndex((f) => f.roundId === selected?.roundId && f.key === selected?.key);
		const next = flat[Math.min(flat.length - 1, Math.max(0, (i === -1 ? 0 : i) + delta))];
		select(next.roundId, next.key, true);
	}

	function jumpRound(delta: number) {
		const ri = Math.min(rounds.length - 1, Math.max(0, currentRoundIndex + delta));
		const round = rounds[ri];
		if (round) select(round.id, round.keys[0] ?? null, true);
	}

	// --- Visszavonás (szerkezeti műveletek) ----------------------------------
	type Snapshot = Record<string, string[]>;
	let undoStack = $state<{ before: Snapshot; after: Snapshot; label: string }[]>([]);
	let redoStack = $state<{ before: Snapshot; after: Snapshot; label: string }[]>([]);

	const snap = (ids: string[]): Snapshot =>
		Object.fromEntries(rounds.filter((r) => ids.includes(r.id)).map((r) => [r.id, [...r.keys]]));

	function record(before: Snapshot, label: string) {
		undoStack = [...undoStack.slice(-49), { before, after: snap(Object.keys(before)), label }];
		redoStack = [];
	}

	async function applySnapshot(s: Snapshot) {
		for (const [roundId, keys] of Object.entries(s)) {
			const round = rounds.find((r) => r.id === roundId);
			if (round) round.keys = [...keys];
		}
		for (const roundId of Object.keys(s)) await persistRound(roundId);
		if (selected?.key && !rounds.some((r) => r.keys.includes(selected!.key!))) {
			const first = rounds.find((r) => r.id === selected?.roundId);
			select(selected.roundId, first?.keys[0] ?? null);
		}
	}

	async function undo() {
		const entry = undoStack.at(-1);
		if (!entry) return;
		undoStack = undoStack.slice(0, -1);
		redoStack = [...redoStack, entry];
		await applySnapshot(entry.before);
		toast(`Visszavonva: ${entry.label}`);
	}

	async function redo() {
		const entry = redoStack.at(-1);
		if (!entry) return;
		redoStack = redoStack.slice(0, -1);
		undoStack = [...undoStack, entry];
		await applySnapshot(entry.after);
		toast(`Újra: ${entry.label}`);
	}

	// --- Szerkezeti műveletek --------------------------------------------------
	async function moveQuestion(fromId: string, key: string, toId: string, toIndex: number) {
		const from = rounds.find((r) => r.id === fromId);
		const to = rounds.find((r) => r.id === toId);
		if (!from || !to) return;
		if (fromId !== toId && to.keys.includes(key)) {
			toast.error('Ez a kérdés már szerepel abban a körben.');
			return;
		}
		const before = snap([fromId, toId]);
		const fromIndex = from.keys.indexOf(key);
		from.keys = from.keys.filter((k) => k !== key);
		const target = fromId === toId ? from : to;
		const index = Math.min(target.keys.length, Math.max(0, toIndex));
		target.keys = [...target.keys.slice(0, index), key, ...target.keys.slice(index)];
		if (fromId === toId && index === fromIndex) return;
		record(before, 'áthelyezés');
		selected = { roundId: toId, key };
		await persistRound(fromId);
		if (toId !== fromId) await persistRound(toId);
	}

	function moveCurrent(delta: number) {
		if (!currentRound || !currentKey) return;
		const i = currentIndex + delta;
		if (i >= 0 && i < currentRound.keys.length) {
			void moveQuestion(currentRound.id, currentKey, currentRound.id, i);
		} else {
			const neighbour = rounds[currentRoundIndex + (delta < 0 ? -1 : 1)];
			if (neighbour) {
				void moveQuestion(
					currentRound.id,
					currentKey,
					neighbour.id,
					delta < 0 ? neighbour.keys.length : 0
				);
			}
		}
		void focusRailItem();
	}

	async function removeCurrent() {
		if (!currentRound || !currentKey) return;
		const round = currentRound;
		const key = currentKey;
		const before = snap([round.id]);
		const index = round.keys.indexOf(key);
		round.keys = round.keys.filter((k) => k !== key);
		record(before, 'eltávolítás a körből');
		select(round.id, round.keys[Math.min(index, round.keys.length - 1)] ?? null, true);
		await persistRound(round.id);
		toast('Kérdés eltávolítva a körből (a kérdésbankban megmarad).', {
			action: { label: 'Visszavonás (Ctrl+Z)', onClick: () => void undo() }
		});
	}

	function newQuestion() {
		const round = currentRound ?? rounds[0];
		if (!round) {
			toast.error('Előbb adj hozzá egy kört (Shift+N).');
			return;
		}
		const template = currentDraft;
		// Új kérdés mindig "Egy helyes"-ként indul (T-vel váltható); a téma, az
		// idő és a pontozás az aktuális kérdésből öröklődik.
		const type = types.find((t) => t.code === 'single_choice') ?? types[0];
		const draft = emptyDraft(type, template?.theme_id ?? null, template);
		drafts[draft.key] = draft;
		const index =
			round.id === currentRound?.id && currentIndex >= 0 ? currentIndex + 1 : round.keys.length;
		const before = snap([round.id]);
		round.keys = [...round.keys.slice(0, index), draft.key, ...round.keys.slice(index)];
		record(before, 'új kérdés');
		view = 'editor';
		select(round.id, draft.key);
		void tick().then(() => document.getElementById('bq-prompt')?.focus());
	}

	async function duplicateCurrent() {
		if (!currentRound || !currentDraft || !currentKey) return;
		const round = currentRound;
		const index = currentIndex + 1;
		if (!currentDraft.id) {
			const copy = { ...($state.snapshot(currentDraft) as Draft), key: newLocalKey(), id: null };
			drafts[copy.key] = copy;
			round.keys = [...round.keys.slice(0, index), copy.key, ...round.keys.slice(index)];
			select(round.id, copy.key);
			return;
		}
		flush(currentKey);
		busy = true;
		try {
			const before = snap([round.id]);
			const order = idsOf(round.keys);
			const at = idsOf(round.keys.slice(0, index)).length;
			order.splice(at, 0, '__new__');
			const res = await api<{ id: string; draft: Draft }>({
				op: 'duplicate',
				question_id: currentDraft.id,
				round_id: round.id,
				order
			});
			drafts[res.id] = res.draft;
			savedSig[res.id] = draftSignature(res.draft);
			round.keys = [...round.keys.slice(0, index), res.id, ...round.keys.slice(index)];
			record(before, 'duplikálás');
			select(round.id, res.id, true);
			toast.success('Kérdés duplikálva.');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	function cycleType() {
		if (!currentKey || !currentDraft) return;
		const i = TYPE_ORDER.indexOf(currentDraft.type_code);
		const next = types.find((t) => t.code === TYPE_ORDER[(i + 1) % TYPE_ORDER.length]);
		if (next) drafts[currentKey] = convertDraft(currentDraft, next);
	}

	async function setStandings(value: boolean) {
		if (!currentRound || !currentDraft?.id) {
			toast('Az állás-beállítás a kérdés első mentése után állítható.');
			return;
		}
		const id = `${currentRound.id}:${currentDraft.id}`;
		hidden[id] = !value;
		try {
			await api({
				op: 'setStandings',
				round_id: currentRound.id,
				question_id: currentDraft.id,
				show: value
			});
		} catch (err) {
			hidden[id] = value;
			toast.error((err as Error).message);
		}
	}

	const showsStandings = (roundId: string, key: string) => {
		const id = drafts[key]?.id;
		return !id || !hidden[`${roundId}:${id}`];
	};

	// --- Körök ------------------------------------------------------------------
	async function addRound(e?: SubmitEvent) {
		e?.preventDefault();
		const title = newRoundTitle.trim() || `${rounds.length + 1}. kör`;
		busy = true;
		try {
			const res = await api<{ round: { id: string; title: string } }>({ op: 'addRound', title });
			rounds = [...rounds, { id: res.round.id, title: res.round.title, keys: [] }];
			newRoundTitle = '';
			select(res.round.id, null);
			newRoundInput?.blur();
			toast.success('Kör hozzáadva — N új kérdés, B kérdésbank.');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function renameRound(round: BuilderRound, title: string) {
		renamingRound = null;
		const clean = title.trim();
		if (!clean || clean === round.title) return;
		const old = round.title;
		round.title = clean;
		try {
			await api({ op: 'renameRound', round_id: round.id, title: clean });
		} catch (err) {
			round.title = old;
			toast.error((err as Error).message);
		}
	}

	async function deleteRound(round: BuilderRound) {
		if (
			!confirm(
				`Törlöd a(z) „${round.title}” kört? A kérdései a kérdésbankban megmaradnak. Ez nem vonható vissza.`
			)
		)
			return;
		try {
			await api({ op: 'deleteRound', round_id: round.id });
			rounds = rounds.filter((r) => r.id !== round.id);
			undoStack = undoStack.filter((u) => !(round.id in u.before));
			redoStack = [];
			const first = rounds[0];
			selected = first ? { roundId: first.id, key: first.keys[0] ?? null } : null;
			toast.success('Kör törölve.');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	// --- Kérdésbank -------------------------------------------------------------
	async function addFromBank(ids: string[]) {
		const round = currentRound ?? rounds[0];
		if (!round) return;
		const newIds = ids.filter((id) => !idsOf(round.keys).includes(id));
		if (newIds.length === 0) return;
		const index =
			round.id === currentRound?.id && currentIndex >= 0 ? currentIndex + 1 : round.keys.length;
		const keys = [...round.keys.slice(0, index), ...newIds, ...round.keys.slice(index)];
		busy = true;
		try {
			const before = snap([round.id]);
			// Az új kérdések még nincsenek a drafts-ban: az id-juk maga a kulcs.
			const order = keys
				.map((k) => drafts[k]?.id ?? (newIds.includes(k) ? k : null))
				.filter((x): x is string => !!x);
			const res = await api<{ drafts: Draft[] }>({
				op: 'addFromBank',
				round_id: round.id,
				order,
				new_ids: newIds
			});
			for (const d of res.drafts) {
				drafts[d.key] = d;
				savedSig[d.key] = draftSignature(d);
			}
			round.keys = keys;
			record(before, 'hozzáadás a bankból');
			bankOpen = false;
			view = 'editor';
			select(round.id, newIds[0], true);
			toast.success(`${newIds.length} kérdés hozzáadva.`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function draw(themeId: string, count: number) {
		const round = currentRound ?? rounds[0];
		if (!round) return;
		busy = true;
		try {
			const before = snap([round.id]);
			const res = await api<{ question_ids: string[]; drafts: Draft[] }>({
				op: 'draw',
				round_id: round.id,
				theme_id: themeId,
				count
			});
			for (const d of res.drafts) {
				drafts[d.key] = d;
				savedSig[d.key] = draftSignature(d);
			}
			const localOnly = round.keys.filter((k) => !drafts[k]?.id);
			round.keys = [...res.question_ids, ...localOnly];
			record(before, 'random húzás');
			bankOpen = false;
			view = 'editor';
			if (res.drafts[0]) select(round.id, res.drafts[0].key, true);
			toast.success(`${res.drafts.length} random kérdés a körbe.`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function drawAll(themeId: string, count: number) {
		busy = true;
		try {
			const before = snap(rounds.map((r) => r.id));
			const res = await api<{ rounds: Record<string, string[]>; drafts: Draft[] }>({
				op: 'drawAll',
				theme_id: themeId,
				count
			});
			for (const d of res.drafts) {
				drafts[d.key] = d;
				savedSig[d.key] = draftSignature(d);
			}
			for (const round of rounds) {
				const ids = res.rounds[round.id];
				if (ids) round.keys = [...ids, ...round.keys.filter((k) => !drafts[k]?.id)];
			}
			record(before, 'random töltés');
			toast.success(`${res.drafts.length} random kérdés betöltve.`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	// --- Előnézet ---------------------------------------------------------------
	$effect(() => {
		if (!previewDialog) return;
		if (previewOpen && !previewDialog.open) previewDialog.showModal();
		if (!previewOpen && previewDialog.open) previewDialog.close();
	});

	// --- Billentyűzet -----------------------------------------------------------
	function isTyping(el: EventTarget | null): boolean {
		if (!(el instanceof HTMLElement)) return false;
		if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
		if (el.tagName !== 'INPUT') return false;
		const type = (el as HTMLInputElement).type;
		return !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(type);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || bankOpen || helpOpen || previewOpen) return;
		if (document.querySelector('dialog[open]')) return;
		const typing = isTyping(e.target);
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key;

		if (key === 'Escape' && typing) {
			(e.target as HTMLElement).blur();
			e.preventDefault();
			void focusRailItem();
			return;
		}
		if (mod && key.toLowerCase() === 's') {
			e.preventDefault();
			flushAll();
			toast('Mentés…');
			return;
		}
		if (e.altKey && !mod && /^Digit[1-8]$/.test(e.code) && view === 'editor') {
			e.preventDefault();
			const i = Number(e.code.slice(5)) - 1;
			(document.getElementById(`bq-opt-${i}`) ?? document.getElementById(`bq-item-${i}`))?.focus();
			return;
		}
		if (typing) return;

		if (mod && !e.altKey) {
			const k = key.toLowerCase();
			if (k === 'z') {
				e.preventDefault();
				void (e.shiftKey ? redo() : undo());
			} else if (k === 'y') {
				e.preventDefault();
				void redo();
			} else if (k === 'd') {
				e.preventDefault();
				void duplicateCurrent();
			} else if (key === 'ArrowUp' || key === 'ArrowDown') {
				e.preventDefault();
				jumpRound(key === 'ArrowUp' ? -1 : 1);
			}
			return;
		}
		if (e.altKey) {
			if (key === 'ArrowUp' || key === 'ArrowDown') {
				e.preventDefault();
				moveCurrent(key === 'ArrowUp' ? -1 : 1);
			}
			return;
		}

		const handled = () => e.preventDefault();
		switch (key) {
			case 'ArrowUp':
			case 'k':
			case 'K':
				if (view === 'editor') {
					handled();
					step(-1);
				}
				return;
			case 'ArrowDown':
			case 'j':
			case 'J':
				if (view === 'editor') {
					handled();
					step(1);
				}
				return;
			case 'Home':
				handled();
				if (flat[0]) select(flat[0].roundId, flat[0].key, true);
				return;
			case 'End':
				handled();
				if (flat.length) select(flat[flat.length - 1].roundId, flat[flat.length - 1].key, true);
				return;
			case 'Enter':
				if (view === 'editor' && currentDraft) {
					handled();
					document.getElementById('bq-prompt')?.focus();
				}
				return;
			case 'Delete':
			case 'Backspace':
				handled();
				void removeCurrent();
				return;
			case 'n':
				handled();
				newQuestion();
				return;
			case 'N':
				handled();
				newRoundInput?.focus();
				return;
			case 't':
			case 'T':
				if (view === 'editor') {
					handled();
					cycleType();
				}
				return;
			case 'b':
			case 'B':
			case 'r':
			case 'R':
				handled();
				bankOpen = true;
				return;
			case 'p':
			case 'P':
				if (currentDraft) {
					handled();
					previewOpen = true;
				}
				return;
			case 'o':
			case 'O':
				handled();
				view = view === 'editor' ? 'overview' : 'editor';
				return;
			case '?':
				handled();
				helpOpen = true;
				return;
			case 'F8': {
				handled();
				view = 'overview';
				const list = issues.filter((i) => i.key);
				const at = list.findIndex((i) => i.key === currentKey && i.roundId === selected?.roundId);
				const next = list[(at + 1) % Math.max(1, list.length)];
				if (next) {
					void tick().then(() => overview?.focusIssue(issues.indexOf(next)));
				}
				return;
			}
		}
		if (/^[1-8]$/.test(key) && view === 'editor' && currentDraft) {
			handled();
			const i = Number(key) - 1;
			if (currentDraft.type_code === 'slider' || currentDraft.type_code === 'ordering') {
				(
					document.getElementById(`bq-opt-${i}`) ?? document.getElementById(`bq-item-${i}`)
				)?.focus();
			} else canvas?.toggleCorrect(i);
		}
	}

	function onPaste(e: ClipboardEvent) {
		if (isTyping(e.target) || view !== 'editor' || !currentDraft) return;
		const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
		if (file) {
			e.preventDefault();
			canvas?.pasteImage(file);
		}
	}

	const shortcutGroups: ShortcutGroup[] = [
		{
			title: 'Navigálás',
			items: [
				{ label: 'Előző / következő kérdés', keys: ['↑', '↓'] },
				{ label: 'Ugyanez (vim-stílus)', keys: ['K', 'J'] },
				{ label: 'Előző / következő kör', keys: ['Ctrl', '↑/↓'] },
				{ label: 'Első / utolsó kérdés', keys: ['Home', 'End'] },
				{ label: 'Áttekintés ↔ szerkesztő', keys: ['O'] }
			]
		},
		{
			title: 'Szerkesztés',
			items: [
				{ label: 'Kérdésszöveg szerkesztése', keys: ['Enter'] },
				{ label: 'Következő mező', keys: ['Tab'] },
				{ label: 'Helyes válasz (több helyesnél 1–8)', keys: ['1–8'] },
				{ label: 'Válasz szövegének szerkesztése', keys: ['Alt', '1–8'] },
				{ label: 'Típus váltása', keys: ['T'] },
				{ label: 'Kérdés mozgatása (körök között is)', keys: ['Alt', '↑/↓'] },
				{ label: 'Kép beillesztése', keys: ['Ctrl', 'V'] }
			]
		},
		{
			title: 'Létrehozás',
			items: [
				{ label: 'Új kérdés az aktuális után', keys: ['N'] },
				{ label: 'Új kör', keys: ['Shift', 'N'] },
				{ label: 'Kérdésbank (random is)', keys: ['B'] },
				{ label: 'Kérdés duplikálása', keys: ['Ctrl', 'D'] },
				{ label: 'Eltávolítás a körből (visszavonható)', keys: ['Del'] }
			]
		},
		{
			title: 'Egyéb',
			items: [
				{ label: 'Előnézet kivetítő-nézetben', keys: ['P'] },
				{ label: 'Visszavonás / újra', keys: ['Ctrl', 'Z / Y'] },
				{ label: 'Mentés most', keys: ['Ctrl', 'S'] },
				{ label: 'Következő hiba az ellenőrzésben', keys: ['F8'] },
				{ label: 'Ez a súgó', keys: ['?'] },
				{ label: 'Kilépés mezőből / ablak bezárása', keys: ['Esc'] }
			]
		}
	];

	const roundMinutes = (round: BuilderRound) =>
		Math.round(
			round.keys.reduce((sum, key) => {
				const d = drafts[key];
				return d ? sum + d.time_limit_seconds + effectiveReading(d, data.readingDefault) + 20 : sum;
			}, 0) / 60
		);
</script>

<svelte:head>
	<title>{data.game.title} — Kvízösszerakó</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} onpaste={onPaste} />

<div class="builder">
	<header class="topbar">
		<a class="back" href={resolve('/admin/games')}>← Kvízesték</a>
		<div class="title">
			<h1>{data.game.title}</h1>
			{#if anySaving}
				<span class="chip saving">Mentés…</span>
			{:else if unsavedKeys.length > 0}
				<span class="chip unsaved" title={currentError ?? ''}>● Nem mentett változás</span>
			{:else}
				<span class="chip saved">● Mentve</span>
			{/if}
		</div>
		<nav class="views" aria-label="Kvízeste nézetek" data-tour="tab-rounds">
			<button
				type="button"
				class:active={view === 'editor'}
				aria-pressed={view === 'editor'}
				onclick={() => (view = 'editor')}>Szerkesztő</button
			>
			<button
				type="button"
				class:active={view === 'overview'}
				aria-pressed={view === 'overview'}
				onclick={() => (view = 'overview')}
				data-tour="qb-overview"
				>Áttekintés{#if errorCount > 0}<span class="count">{errorCount}</span>{/if}</button
			>
			<a href={resolve('/admin/games/[id]/event', { id: gameId })} data-tour="tab-event">Esemény</a>
			<a href={resolve('/admin/games/[id]/results', { id: gameId })}>Eredmények</a>
		</nav>
		<div class="top-actions">
			{#if tourState.current}<TourButton />{/if}
			<button
				type="button"
				class="ghost"
				onclick={() => (helpOpen = true)}
				title="Billentyűparancsok">? <span class="hide-sm">Billentyűk</span></button
			>
			<button
				type="button"
				class="ghost"
				disabled={!currentDraft}
				onclick={() => (previewOpen = true)}>Előnézet <kbd>P</kbd></button
			>
			{#if data.game.status === 'finished'}
				<ReopenGameButton {gameId} />
			{/if}
			{#if errorCount > 0}
				<button
					type="button"
					class="primary"
					data-tour="gs-open-host"
					title="Előbb javítsd a hibákat (Áttekintés)"
					onclick={() => {
						view = 'overview';
						toast.error(`${errorCount} hiba javítandó az élő indítás előtt.`);
					}}>Élő lebonyolítás →</button
				>
			{:else}
				<a
					class="primary"
					data-tour="gs-open-host"
					href={resolve('/host/[game_id]', { game_id: gameId })}>Élő lebonyolítás →</a
				>
			{/if}
		</div>
	</header>

	{#if view === 'overview'}
		<div class="body overview-body">
			<BuilderOverview
				bind:this={overview}
				{rounds}
				{drafts}
				{issues}
				themes={data.themes}
				selected={selected?.key ? { roundId: selected.roundId, key: selected.key } : null}
				readingDefault={data.readingDefault}
				{showsStandings}
				{busy}
				onselect={(roundId, key) => select(roundId, key)}
				onopen={(roundId, key) => {
					select(roundId, key);
					view = 'editor';
					void focusRailItem();
				}}
				onmove={(from, key, to, index) => void moveQuestion(from, key, to, index)}
				ondrawall={(themeId, count) => void drawAll(themeId, count)}
			/>
		</div>
	{:else}
		<div class="body">
			<aside class="rail" aria-label="Menetrend" data-tour="qb-rail">
				<div class="rail-head">
					<span>Menetrend</span>
					<span class="dim">{rounds.length} kör · {flat.length} kérdés</span>
				</div>
				<div class="rail-list">
					{#each rounds as round, ri (round.id)}
						<div class="rail-round">
							<div class="round-head">
								<button
									type="button"
									class="collapse"
									aria-expanded={!collapsed[round.id]}
									aria-label="{round.title} kör {collapsed[round.id]
										? 'kinyitása'
										: 'összecsukása'}"
									onclick={() => (collapsed[round.id] = !collapsed[round.id])}
									>{collapsed[round.id] ? '▸' : '▾'}</button
								>
								{#if renamingRound === round.id}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="rename"
										value={round.title}
										autofocus
										aria-label="Kör neve"
										onblur={(e) => renameRound(round, e.currentTarget.value)}
										onkeydown={(e) => {
											if (e.key === 'Enter') e.currentTarget.blur();
											if (e.key === 'Escape') {
												e.stopPropagation();
												renamingRound = null;
											}
										}}
									/>
								{:else}
									<button
										type="button"
										class="round-title"
										title="Átnevezés (kattints)"
										onclick={() => {
											select(round.id, round.keys[0] ?? null);
											renamingRound = round.id;
										}}>{ri + 1}. {round.title}</button
									>
								{/if}
								<span class="dim">{round.keys.length} · ~{roundMinutes(round)} p</span>
								<button
									type="button"
									class="icon"
									aria-label="{round.title} kör törlése"
									title="Kör törlése"
									onclick={() => deleteRound(round)}>✕</button
								>
							</div>
							{#if !collapsed[round.id]}
								<ol class="rail-questions">
									{#each round.keys as key, qi (key)}
										{@const d = drafts[key]}
										{@const err = d ? draftError(d, types) : null}
										<li>
											<button
												type="button"
												class="rail-item"
												class:active={selected?.roundId === round.id && selected?.key === key}
												data-rail-key="{round.id}:{key}"
												onclick={() => select(round.id, key)}
												aria-current={selected?.roundId === round.id && selected?.key === key
													? 'true'
													: undefined}
											>
												<span class="num">{qi + 1}</span>
												<span class="text">
													<span class="prompt">{d?.prompt || '— új kérdés —'}</span>
													<span class="meta"
														>{TYPE_SHORT[d?.type_code ?? ''] ?? ''} · {d?.time_limit_seconds} mp{d?.image_url
															? ' · kép'
															: ''}</span
													>
												</span>
												<span class="flags">
													{#if err}<span class="err" title={err}>!</span>
													{:else if saving[key] || (d && isDirty(key))}<span
															class="dirty"
															title="Mentés folyamatban">•</span
														>{/if}
													{#if showsStandings(round.id, key)}<span
															class="stand"
															title="Állás a kérdés után">●</span
														>{/if}
												</span>
											</button>
										</li>
									{:else}
										<li class="empty-round">
											Üres kör — <kbd>N</kbd> új kérdés, <kbd>B</kbd> bank
										</li>
									{/each}
									{#if round.keys.length > 0}
										<li class="round-end">Kör vége · Top 3</li>
									{/if}
								</ol>
							{/if}
						</div>
					{/each}
				</div>
				<form class="add-round" onsubmit={addRound} data-tour="gs-add-round">
					<input
						bind:this={newRoundInput}
						bind:value={newRoundTitle}
						placeholder="{rounds.length + 1}. kör neve (Shift+N)"
						aria-label="Új kör neve"
					/>
					<button type="submit" disabled={busy}>+ Kör</button>
				</form>
				<div class="rail-actions">
					<button type="button" class="outline" onclick={newQuestion} data-tour="qb-new"
						>+ Kérdés <kbd>N</kbd></button
					>
					<button type="button" class="ghost" onclick={() => (bankOpen = true)} data-tour="gs-pick"
						>Kérdésbank <kbd>B</kbd></button
					>
				</div>
			</aside>

			<main class="stage">
				{#if currentDraft && currentKey}
					<div class="crumbs">
						<span>{currentRoundIndex + 1}. kör · {currentRound?.title}</span>
						<span>›</span>
						<strong>{currentIndex + 1}. kérdés / {currentRound?.keys.length}</strong>
						<span class="crumb-chips">
							<span
								>{effectiveReading(currentDraft, data.readingDefault)} mp olvasás · {currentDraft.time_limit_seconds}
								mp válasz</span
							>
							<span
								>{currentDraft.points} pont{currentDraft.points_multiplier !== 1
									? ` ×${currentDraft.points_multiplier}`
									: ''}{currentDraft.points_decay ? ' · csökkenő' : ''}</span
							>
						</span>
					</div>
					{#if currentError}
						<p class="draft-error" role="status">Még nem menthető: {currentError}</p>
					{:else if saveErrors[currentKey]}
						<p class="draft-error" role="alert">Mentési hiba: {saveErrors[currentKey]}</p>
					{/if}
					{#if currentDraft.id && playedCount(currentDraft.id) > 0}
						<p class="note">Ez a kérdés már elhangzott egy korábbi estén.</p>
					{/if}
					<QuestionCanvas bind:this={canvas} bind:draft={drafts[currentKey]} {types} />
				{:else}
					<div class="empty-stage">
						{#if rounds.length === 0}
							<h2>Kezdjük az első körrel</h2>
							<p>
								Add meg a kör nevét bal oldalt (vagy <kbd>Shift</kbd>+<kbd>N</kbd>), aztán jöhetnek
								a kérdések.
							</p>
						{:else}
							<h2>Üres kör</h2>
							<p>
								<kbd>N</kbd> új kérdés · <kbd>B</kbd> kérdésbank (random húzás is) · <kbd>?</kbd> billentyűparancsok
							</p>
						{/if}
					</div>
				{/if}
			</main>

			<aside class="side" aria-label="Kérdés beállításai" data-tour="qb-settings">
				{#if currentDraft && currentKey && currentRound}
					<QuestionSettings
						bind:draft={drafts[currentKey]}
						{types}
						themes={data.themes}
						readingDefault={data.readingDefault}
						showStandings={showsStandings(currentRound.id, currentKey)}
						onstandingschange={(v) => void setStandings(v)}
						onduplicate={() => void duplicateCurrent()}
						onremove={() => void removeCurrent()}
					/>
				{:else}
					<p class="dim">Válassz egy kérdést a menetrendből.</p>
				{/if}
			</aside>
		</div>
	{/if}

	<footer class="keybar" aria-label="Billentyű-súgó">
		<span><kbd>↑ ↓</kbd> kérdések</span>
		<span><kbd>Enter</kbd> szerkesztés</span>
		<span><kbd>1–8</kbd> helyes válasz</span>
		<span><kbd>N</kbd> új kérdés</span>
		<span><kbd>Alt ↑↓</kbd> áthelyezés</span>
		<span><kbd>Esc</kbd> vissza a listába</span>
		<button type="button" onclick={() => (helpOpen = true)}><kbd>?</kbd> összes parancs</button>
	</footer>
</div>

<BankDrawer
	bind:open={bankOpen}
	{bank}
	themes={data.themes}
	targetLabel={currentRound
		? `${currentRoundIndex + 1}. kör · ${currentRound.title}${currentIndex >= 0 ? `, a ${currentIndex + 1}. kérdés után` : ''}`
		: 'nincs kör'}
	excludeIds={currentRound ? idsOf(currentRound.keys) : []}
	defaultThemeId={currentDraft?.theme_id ?? null}
	{busy}
	onadd={(ids) => void addFromBank(ids)}
	ondraw={(themeId, count) => void draw(themeId, count)}
/>

<ShortcutHelp
	bind:open={helpOpen}
	title="Billentyűparancsok · összerakás"
	note="Az egybetűs parancsok csak akkor élnek, ha nem szövegmezőben gépelsz. Szövegmezőből Esc visz vissza a listára."
	groups={shortcutGroups}
/>

<dialog
	bind:this={previewDialog}
	class="preview-dialog"
	aria-label="Kivetítő-előnézet"
	onclose={() => (previewOpen = false)}
>
	{#if previewOpen && currentDraft}
		<QuestionPreview
			draft={currentDraft}
			roundTitle={currentRound?.title ?? ''}
			position={currentIndex + 1}
			total={currentRound?.keys.length ?? 0}
			readingSeconds={effectiveReading(currentDraft, data.readingDefault)}
		/>
		<button type="button" class="close-preview" onclick={() => (previewOpen = false)}
			>Bezárás · Esc</button
		>
	{/if}
</dialog>

<style>
	.builder {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--cabinet);
		color: var(--marquee);
	}

	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.1rem;
		min-height: 4rem;
		box-sizing: border-box;
		padding: 0.5rem 1.2rem;
		background: var(--cabinet-2);
		border-bottom: 1px solid var(--panel-border, #e4ded2);
	}

	.back {
		color: var(--marquee-dim);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.35rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 22rem;
	}

	.chip {
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.chip.saved {
		color: var(--power);
	}

	.chip.saving {
		color: var(--marquee-dim);
	}

	.chip.unsaved {
		color: var(--coin);
	}

	.views {
		display: flex;
		padding: 4px;
		margin: 0 auto;
		border-radius: 0.65rem;
		background: var(--cabinet);
		font-size: 0.9rem;
	}

	.views button,
	.views a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.85rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--marquee-dim);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.views .active {
		background: var(--cabinet-2);
		color: var(--marquee);
		font-weight: 600;
	}

	.count {
		min-width: 1.2rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--danger);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
		text-align: center;
	}

	.top-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.ghost,
	.primary,
	.outline {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.5rem;
		box-sizing: border-box;
		padding: 0 0.85rem;
		border-radius: 0.55rem;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.ghost {
		border: 1px solid var(--field-border, #d5cec0);
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.ghost:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.primary {
		border: 0;
		background: var(--btn-primary, var(--cyan));
		color: var(--on-primary, #fff);
	}

	.outline {
		justify-content: center;
		border: 1px solid var(--cyan);
		background: var(--cabinet-2);
		color: var(--cyan);
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		opacity: 0.8;
	}

	:is(button, a, input):focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 18rem minmax(0, 1fr) 20rem;
	}

	.overview-body {
		display: block;
	}

	.rail {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--cabinet-2);
		border-right: 1px solid var(--panel-border, #e4ded2);
	}

	.rail-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.9rem 1rem 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.dim {
		color: var(--marquee-dim);
		font-size: 0.78rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
	}

	.rail-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 0.6rem 0.6rem;
	}

	.round-head {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.6rem 0.2rem 0.3rem;
	}

	.collapse,
	.icon {
		width: 1.6rem;
		height: 1.6rem;
		border: 0;
		border-radius: 0.3rem;
		background: transparent;
		color: var(--marquee-dim);
	}

	.icon {
		opacity: 0.6;
	}

	.icon:hover {
		opacity: 1;
		color: var(--danger);
	}

	.round-title {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--marquee);
		font-weight: 700;
		font-size: 0.95rem;
		text-align: left;
		padding: 0.2rem 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rename {
		flex: 1;
		min-width: 0;
		height: 1.9rem;
		border: 2px solid var(--cyan);
		border-radius: 0.4rem;
		padding: 0 0.4rem;
		font: inherit;
		font-weight: 700;
	}

	.rail-questions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.rail-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.55rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.65rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		text-align: left;
	}

	.rail-item.active {
		border: 2px solid var(--cyan);
		background: color-mix(in srgb, var(--cyan) 10%, var(--cabinet-2));
		padding: calc(0.5rem - 1px) calc(0.55rem - 1px);
	}

	.num {
		width: 1.6rem;
		height: 1.6rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.4rem;
		background: var(--cabinet);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.text {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.prompt {
		font-size: 0.83rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 0.72rem;
		color: var(--marquee-dim);
	}

	.flags {
		display: flex;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	.err {
		color: var(--danger);
		font-weight: 800;
	}

	.dirty {
		color: var(--coin);
		font-weight: 800;
	}

	.stand {
		color: var(--cyan);
		font-size: 0.6rem;
	}

	.empty-round,
	.round-end {
		padding: 0.55rem 0.7rem;
		border: 1px dashed var(--field-border, #c9bfa9);
		border-radius: 0.65rem;
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.add-round {
		display: flex;
		gap: 0.4rem;
		padding: 0.6rem 0.75rem 0;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}

	.add-round input {
		flex: 1;
		min-width: 0;
		height: 2.4rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.6rem;
		font: inherit;
		font-size: 0.88rem;
	}

	.add-round button {
		height: 2.4rem;
		padding: 0 0.7rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		font-weight: 600;
	}

	.rail-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0.6rem 0.75rem 0.75rem;
	}

	.rail-actions .ghost {
		justify-content: center;
	}

	.stage {
		min-width: 0;
		overflow-y: auto;
		padding: 1.1rem 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--marquee-dim);
	}

	.crumbs strong {
		color: var(--marquee);
	}

	.crumb-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-left: auto;
	}

	.crumb-chips span {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 999px;
		background: var(--cabinet-2);
	}

	.draft-error,
	.note {
		margin: 0;
		padding: 0.5rem 0.8rem;
		border-radius: 0.55rem;
		font-size: 0.85rem;
	}

	.draft-error {
		background: color-mix(in srgb, var(--coin) 12%, var(--cabinet-2));
		color: var(--marquee);
	}

	.note {
		background: color-mix(in srgb, var(--cabinet-3) 70%, var(--cabinet-2));
		color: var(--marquee-dim);
	}

	.empty-stage {
		margin: auto;
		max-width: 30rem;
		text-align: center;
		color: var(--marquee-dim);
	}

	.empty-stage h2 {
		font-family: var(--font-display);
		font-weight: 400;
		color: var(--marquee);
	}

	.side {
		min-width: 0;
		overflow-y: auto;
		padding: 1rem 1.1rem;
		background: var(--cabinet-2);
		border-left: 1px solid var(--panel-border, #e4ded2);
	}

	.keybar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 1.1rem;
		min-height: 2.3rem;
		padding: 0.3rem 1.2rem;
		box-sizing: border-box;
		background: var(--marquee);
		color: color-mix(in srgb, var(--cabinet-2) 80%, var(--marquee));
		font-size: 0.78rem;
	}

	.keybar kbd {
		color: var(--cabinet-2);
		opacity: 1;
	}

	.keybar button {
		margin-left: auto;
		border: 0;
		background: transparent;
		color: var(--cabinet-2);
		font-size: 0.78rem;
		text-decoration: underline;
	}

	.preview-dialog {
		width: min(64rem, calc(100vw - 2rem));
		padding: 0;
		border: 0;
		background: transparent;
	}

	.preview-dialog::backdrop {
		background: rgb(0 0 0 / 70%);
	}

	.close-preview {
		display: block;
		margin: 0.8rem auto 0;
		padding: 0.5rem 1rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	@media (max-width: 1100px) {
		.body {
			grid-template-columns: 15rem minmax(0, 1fr);
		}

		.side {
			grid-column: 1 / -1;
			border-left: 0;
			border-top: 1px solid var(--panel-border, #e4ded2);
		}

		.builder {
			height: auto;
			min-height: 100dvh;
		}
	}

	@media (max-width: 720px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}

		.rail {
			max-height: 45dvh;
			border-right: 0;
			border-bottom: 1px solid var(--panel-border, #e4ded2);
		}

		.stage {
			padding: 0.9rem 1rem;
		}

		.views {
			margin: 0;
			order: 5;
			width: 100%;
			overflow-x: auto;
		}

		.hide-sm,
		.keybar {
			display: none;
		}

		h1 {
			max-width: 12rem;
		}
	}
</style>
