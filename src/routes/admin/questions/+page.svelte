<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import QuestionCanvas from '$lib/builder/QuestionCanvas.svelte';
	import QuestionSettings from '$lib/builder/QuestionSettings.svelte';
	import {
		convertDraft,
		draftError,
		draftSignature,
		emptyDraft,
		TYPE_ORDER,
		TYPE_SHORT,
		type BankItem,
		type Draft,
		type QuestionUsage
	} from '$lib/builder/model';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { isTypingTarget, plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import type { PageData } from './$types';

	// Kérdésbank — lista · vászon · beállítások, automatikus mentéssel. Ugyanaz
	// a vászon, mint a kvízösszerakóban (docs/features/admin-workspace.md).
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'questions');

	const initial = untrack(() => data);
	const types = initial.questionTypes;
	const NEW = 'new';

	let bank = $state<BankItem[]>(initial.bank);
	let drafts = $state<Record<string, Draft>>({});
	let savedSig = $state<Record<string, string>>({});
	let usage = $state<Record<string, QuestionUsage[]>>({});
	let saving = $state(false);
	let saveError = $state('');
	let loading = $state(false);
	let canvas = $state<ReturnType<typeof QuestionCanvas>>();

	// --- Szűrők -----------------------------------------------------------------
	let search = $state('');
	let themeId = $state(untrack(() => page.url.searchParams.get('theme_id') ?? ''));
	let typeCode = $state('');
	let onlyFresh = $state(false);
	let onlyImage = $state(false);

	const themeTitle = (id: string | null) =>
		data.themes.find((t) => t.id === id)?.title ?? 'téma nélkül';

	const visible = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		return bank.filter(
			(q) =>
				(!themeId || q.theme_id === themeId) &&
				(!typeCode || q.type_code === typeCode) &&
				(!onlyFresh || q.played_count === 0) &&
				(!onlyImage || q.has_image) &&
				(!needle || q.prompt.toLowerCase().includes(needle))
		);
	});

	const selection = createSelection('id', () => visible[0]?.id ?? null);
	const currentKey = $derived(drafts[NEW] && selection.id === NEW ? NEW : selection.id);
	const current = $derived(currentKey ? drafts[currentKey] : undefined);
	const currentError = $derived(current ? draftError(current, types) : null);
	const dirty = $derived(
		!!current && (current.id === null || draftSignature(current) !== savedSig[current.key])
	);

	// --- Betöltés ------------------------------------------------------------------
	async function api<T>(body: Record<string, unknown>): Promise<T> {
		const res = await fetch(resolve('/admin/questions/api'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = (await res.json().catch(() => ({}))) as T & {
			error?: string;
			message?: string;
		};
		if (!res.ok) throw new Error(payload.error ?? payload.message ?? 'Nem sikerült a művelet.');
		return payload;
	}

	$effect(() => {
		const id = selection.id;
		if (!id || id === NEW || drafts[id]) return;
		loading = true;
		untrack(() =>
			api<{ draft: Draft; usage: QuestionUsage[] }>({ op: 'load', id })
				.then((res) => {
					drafts[id] = res.draft;
					savedSig[id] = draftSignature(res.draft);
					usage[id] = res.usage;
				})
				.catch((err) => toast.error((err as Error).message))
				.finally(() => (loading = false))
		);
	});

	// --- Automatikus mentés ---------------------------------------------------------
	let timer: ReturnType<typeof setTimeout> | undefined;
	let resave = false;

	$effect(() => {
		const d = current;
		if (!d) return;
		const sig = draftSignature(d);
		if (d.id && sig === savedSig[d.key]) return;
		clearTimeout(timer);
		if (draftError(d, types)) return;
		timer = setTimeout(() => void save(), 700);
	});

	async function save() {
		const key = currentKey;
		const d = key ? drafts[key] : undefined;
		if (!key || !d || draftError(d, types)) return;
		if (saving) {
			resave = true;
			return;
		}
		const snapshot = $state.snapshot(d) as Draft;
		const sig = draftSignature(snapshot);
		saving = true;
		try {
			const res = await api<{ id: string }>({ op: 'save', draft: snapshot });
			saveError = '';
			if (!snapshot.id) {
				// Az új kérdés mostantól a saját id-ja alatt él.
				const created = { ...drafts[NEW], id: res.id, key: res.id };
				drafts[res.id] = created;
				delete drafts[NEW];
				savedSig[res.id] = sig;
				usage[res.id] = [];
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
				selection.set(res.id);
				toast.success('Kérdés a kérdésbankba mentve.');
			} else {
				savedSig[key] = sig;
				bank = bank.map((b) =>
					b.id === snapshot.id
						? {
								...b,
								prompt: snapshot.prompt,
								theme_id: snapshot.theme_id,
								type_code: snapshot.type_code,
								has_image: !!snapshot.image_url
							}
						: b
				);
			}
		} catch (err) {
			saveError = (err as Error).message;
			toast.error(`Mentés sikertelen: ${saveError}`);
		} finally {
			saving = false;
			if (resave) {
				resave = false;
				void save();
			}
		}
	}

	function flush() {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
			void save();
		}
	}

	beforeNavigate(({ cancel }) => {
		flush();
		if (drafts[NEW] && !confirm('Az új kérdés még hiányos, nincs mentve. Elhagyod az oldalt?'))
			cancel();
	});

	// --- Műveletek --------------------------------------------------------------------
	function select(id: string) {
		flush();
		selection.set(id);
	}

	function newQuestion() {
		flush();
		const type = types.find((t) => t.code === 'single_choice') ?? types[0];
		drafts[NEW] = {
			...emptyDraft(type, themeId || current?.theme_id || null, {
				time_limit_seconds: data.defaultTime,
				points: 1000,
				points_decay: true
			}),
			key: NEW
		};
		selection.set(NEW);
		void tick().then(() => document.getElementById('bq-prompt')?.focus());
	}

	async function duplicate() {
		if (!current?.id) return;
		flush();
		try {
			const res = await api<{ id: string; draft: Draft }>({ op: 'duplicate', id: current.id });
			drafts[res.id] = res.draft;
			savedSig[res.id] = draftSignature(res.draft);
			usage[res.id] = [];
			const source = bank.find((b) => b.id === current?.id);
			bank = [
				{
					...(source ?? {
						prompt: res.draft.prompt,
						theme_id: res.draft.theme_id,
						type_code: res.draft.type_code,
						has_image: !!res.draft.image_url,
						created_at: null,
						played_last: null
					}),
					id: res.id,
					played_count: 0,
					played_last: null
				} as BankItem,
				...bank
			];
			selection.set(res.id);
			toast.success('Kérdés duplikálva.');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	async function remove() {
		if (!current) return;
		if (current.id === null) {
			delete drafts[NEW];
			selection.set(visible[0]?.id ?? null);
			return;
		}
		const used = usage[current.id]?.length ?? 0;
		const ok = confirm(
			`Véglegesen törlöd a kérdést a kérdésbankból?${used ? `\n\nFIGYELEM: ${used} kör(ben) szerepel — onnan is eltűnik.` : ''}`
		);
		if (!ok) return;
		const id = current.id;
		const index = visible.findIndex((q) => q.id === id);
		try {
			await api({ op: 'delete', id });
			bank = bank.filter((b) => b.id !== id);
			delete drafts[id];
			const next = visible[Math.min(index, visible.length - 1)];
			selection.set(next?.id ?? null);
			toast.success('Kérdés törölve.');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	let targetRound = $state('');
	let targetSelect = $state<HTMLSelectElement>();

	async function addToRound() {
		if (!current?.id || !targetRound) return;
		try {
			const res = await api<{ usage: QuestionUsage[] }>({
				op: 'addToRound',
				question_id: current.id,
				round_id: targetRound
			});
			usage[current.id] = res.usage;
			toast.success('Kérdés a kör végére került.');
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	function cycleType() {
		if (!current || !currentKey) return;
		const i = TYPE_ORDER.indexOf(current.type_code);
		const next = types.find((t) => t.code === TYPE_ORDER[(i + 1) % TYPE_ORDER.length]);
		if (next) drafts[currentKey] = convertDraft(current, next);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isTypingTarget(e.target)) {
			(e.target as HTMLElement).blur();
			document.querySelector<HTMLElement>(`[data-rail-id="${selection.id}"]`)?.focus();
			return;
		}
		if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-8]$/.test(e.code)) {
			e.preventDefault();
			const i = Number(e.code.slice(5)) - 1;
			(document.getElementById(`bq-opt-${i}`) ?? document.getElementById(`bq-item-${i}`))?.focus();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !isTypingTarget(e.target)) {
			e.preventDefault();
			void duplicate();
			return;
		}
		if (!plainKey(e)) return;
		const key = e.key;
		if (key === 'n' || key === 'N') {
			e.preventDefault();
			newQuestion();
		} else if ((key === 'Delete' || key === 'Backspace') && current) {
			e.preventDefault();
			void remove();
		} else if ((key === 't' || key === 'T') && current) {
			e.preventDefault();
			cycleType();
		} else if ((key === 'a' || key === 'A') && current?.id) {
			e.preventDefault();
			targetSelect?.focus();
		} else if (/^[1-8]$/.test(key) && current) {
			e.preventDefault();
			canvas?.toggleCorrect(Number(key) - 1);
		}
	}

	function onPaste(e: ClipboardEvent) {
		if (isTypingTarget(e.target) || !current) return;
		const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
		if (file) {
			e.preventDefault();
			canvas?.pasteImage(file);
		}
	}

	onMount(() => {
		if (page.url.searchParams.get('new') === '1') newQuestion();
	});

	registerPageShortcuts(() => [
		{
			title: 'Kérdésbank',
			items: [
				{ label: 'Kérdésszöveg szerkesztése', keys: ['Enter'] },
				{ label: 'Helyes válasz', keys: ['1–8'] },
				{ label: 'Válasz szövege', keys: ['Alt', '1–8'] },
				{ label: 'Típus váltása', keys: ['T'] },
				{ label: 'Új kérdés', keys: ['N'] },
				{ label: 'Duplikálás', keys: ['Ctrl', 'D'] },
				{ label: 'Hozzáadás egy estéhez', keys: ['A'] },
				{ label: 'Törlés a bankból', keys: ['Del'] },
				{ label: 'Kép beillesztése', keys: ['Ctrl', 'V'] }
			]
		}
	]);

	const groups = $derived([
		...(drafts[NEW]
			? [
					{
						label: 'Új, még nem mentett',
						items: [
							{
								id: NEW,
								prompt: drafts[NEW].prompt || '— új kérdés —',
								theme_id: drafts[NEW].theme_id,
								type_code: drafts[NEW].type_code,
								has_image: !!drafts[NEW].image_url,
								created_at: null,
								played_count: 0,
								played_last: null
							} satisfies BankItem
						]
					}
				]
			: []),
		{ label: `${visible.length} kérdés`, items: visible }
	]);
</script>

<svelte:head>
	<title>Kérdésbank — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} onpaste={onPaste} />

<Workspace
	label="Kérdésbank"
	railWidth="20rem"
	sideWidth="20rem"
	keys={[
		['↑ ↓', 'kérdések'],
		['Enter', 'szerkesztés'],
		['1–8', 'helyes válasz'],
		['T', 'típus'],
		['N', 'új kérdés'],
		['A', 'hozzáadás estéhez'],
		['Ctrl D', 'duplikálás']
	]}
>
	{#snippet rail()}
		<RailList
			label="Kérdések"
			{groups}
			getId={(q) => q.id}
			selectedId={currentKey}
			onselect={(q) => select(q.id)}
			onopen={() => document.getElementById('bq-prompt')?.focus()}
			bind:search
			placeholder="Keresés a kérdésekben…"
			empty="Nincs kérdés ezzel a szűréssel."
		>
			{#snippet header()}
				<div class="filters" data-tour="q-filter">
					<select bind:value={themeId} aria-label="Téma">
						<option value="">Minden téma</option>
						{#each data.themes as theme (theme.id)}
							<option value={theme.id}>{theme.title}</option>
						{/each}
					</select>
					<select bind:value={typeCode} aria-label="Típus">
						<option value="">Minden típus</option>
						{#each Object.entries(TYPE_SHORT) as [code, label] (code)}
							<option value={code}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="ws-chips">
					<button
						type="button"
						class="ws-chip"
						aria-pressed={onlyFresh}
						onclick={() => (onlyFresh = !onlyFresh)}>Csak nem játszott</button
					>
					<button
						type="button"
						class="ws-chip"
						aria-pressed={onlyImage}
						onclick={() => (onlyImage = !onlyImage)}>Van kép</button
					>
				</div>
			{/snippet}
			{#snippet item(q)}
				<span class="ws-item-text" data-tour={q.id === visible[0]?.id ? 'q-table' : undefined}>
					<strong>{q.prompt}</strong>
					<small
						>{TYPE_SHORT[q.type_code] ?? q.type_code} · {themeTitle(q.theme_id)}{q.has_image
							? ' · kép'
							: ''}</small
					>
				</span>
				{#if q.id !== NEW}
					<span
						class="ws-pill"
						class:ok={q.played_count === 0}
						data-tour={q.id === visible[0]?.id ? 'q-last-used' : undefined}
						title={q.played_last ? `Legutóbb: ${q.played_last}` : 'Még nem hangzott el'}
						>{q.played_count === 0 ? 'új' : `${q.played_count}×`}</span
					>
				{/if}
			{/snippet}
			{#snippet footer()}
				<button type="button" class="ws-btn outline" data-tour="q-new" onclick={newQuestion}
					>+ Kérdés <kbd class="ws-kbd">N</kbd></button
				>
			{/snippet}
		</RailList>
	{/snippet}

	{#snippet main()}
		{#if current && currentKey}
			<div class="ws-crumb">
				Kérdésbank › {themeTitle(current.theme_id)}
				{#if saving}<span class="ws-saved busy">Mentés…</span>
				{:else if saveError}<span class="ws-saved error">● Mentési hiba</span>
				{:else if dirty}<span class="ws-saved busy">● Nem mentett változás</span>
				{:else}<span class="ws-saved">● Mentve</span>{/if}
			</div>
			{#if currentError}
				<p class="draft-error" role="status">Még nem menthető: {currentError}</p>
			{/if}
			<QuestionCanvas bind:this={canvas} bind:draft={drafts[currentKey]} {types} />
		{:else if loading}
			<p class="ws-note">Betöltés…</p>
		{:else}
			<div class="ws-empty">
				<h2>Válassz egy kérdést</h2>
				<p>Bal oldalt ↑/↓, vagy új kérdés: N.</p>
			</div>
		{/if}
	{/snippet}

	{#snippet side()}
		{#if current && currentKey}
			<QuestionSettings
				bind:draft={drafts[currentKey]}
				{types}
				themes={data.themes}
				readingDefault={data.readingDefault}
				onduplicate={current.id ? () => void duplicate() : undefined}
				onremove={() => void remove()}
				removeLabel={current.id ? 'Törlés a bankból' : 'Elvetés'}
			/>
			{#if current.id}
				<div class="usage" data-tour="q-row-actions">
					<p class="ws-cap">Hol szerepel</p>
					{#each usage[current.id] ?? [] as u (u.game_id + u.round_title)}
						<a class="ws-action" href={resolve('/admin/games/[id]', { id: u.game_id })}
							><span>{u.game_title}<small> · {u.round_title}</small></span>
							<span class="ws-pill" class:warn={u.status !== 'finished'}
								>{u.status === 'finished' ? 'lezárt' : 'közelgő'}</span
							></a
						>
					{:else}
						<p class="ws-note">Még egyik estén sem szerepel.</p>
					{/each}
					{#if data.games.length > 0}
						<div class="add-row">
							<select
								bind:this={targetSelect}
								bind:value={targetRound}
								aria-label="Kör kiválasztása"
							>
								<option value="">Hozzáadás estéhez… (A)</option>
								{#each data.games as game (game.id)}
									<optgroup label={game.title}>
										{#each game.rounds as round (round.id)}
											<option value={round.id}>{round.order_index}. {round.title}</option>
										{/each}
									</optgroup>
								{/each}
							</select>
							<button type="button" class="ws-btn" disabled={!targetRound} onclick={addToRound}
								>Hozzáad</button
							>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	{/snippet}
</Workspace>

<style>
	.filters {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.filters select,
	.add-row select {
		min-width: 0;
		height: 2.2rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		padding: 0 0.5rem;
		font: inherit;
		font-size: 0.85rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.draft-error {
		margin: 0;
		padding: 0.5rem 0.8rem;
		border-radius: 0.55rem;
		background: color-mix(in srgb, var(--coin) 12%, var(--cabinet-2));
		font-size: 0.85rem;
	}

	.usage {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}

	.usage small {
		font-weight: 400;
		color: var(--marquee-dim);
	}

	.add-row {
		display: flex;
		gap: 0.4rem;
	}

	.add-row select {
		flex: 1;
	}
</style>
