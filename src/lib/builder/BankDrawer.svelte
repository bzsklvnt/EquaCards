<script lang="ts">
	import { TYPE_SHORT, type BankItem } from './model';

	// Kérdésbank-fiók a kvízösszerakóban: a szerkesztő fölött nyílik, nem visz
	// el másik oldalra. Billentyűzettel: / keresés, ↑↓ léptetés, Szóköz jelöl,
	// Shift+↑↓ tartomány, Enter hozzáad, R random, Esc bezár.
	let {
		open = $bindable(false),
		bank,
		themes,
		targetLabel,
		excludeIds,
		defaultThemeId,
		busy = false,
		onadd,
		ondraw
	}: {
		open?: boolean;
		bank: BankItem[];
		themes: { id: string; title: string }[];
		targetLabel: string;
		excludeIds: string[];
		defaultThemeId: string | null;
		busy?: boolean;
		onadd: (ids: string[]) => void;
		ondraw: (themeId: string, count: number) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let searchEl = $state<HTMLInputElement>();
	let search = $state('');
	let themeId = $state('');
	let typeCode = $state('');
	let onlyFresh = $state(true);
	let onlyImage = $state(false);
	let selected = $state<string[]>([]);
	let focusIndex = $state(0);
	let anchorIndex = $state<number | null>(null);
	let drawCount = $state(8);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			themeId = defaultThemeId ?? '';
			selected = [];
			focusIndex = 0;
			dialog.showModal();
			queueMicrotask(() => searchEl?.focus());
		}
		if (!open && dialog.open) dialog.close();
	});

	const excluded = $derived(new Set(excludeIds));
	const results = $derived.by(() => {
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

	$effect(() => {
		if (focusIndex >= results.length) focusIndex = Math.max(0, results.length - 1);
	});

	function toggle(id: string) {
		if (excluded.has(id)) return;
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	function selectRange(from: number, to: number) {
		const [a, b] = from < to ? [from, to] : [to, from];
		const ids = results
			.slice(a, b + 1)
			.map((q) => q.id)
			.filter((id) => !excluded.has(id));
		selected = [...new Set([...selected, ...ids])];
	}

	function scrollFocused() {
		queueMicrotask(() =>
			document.getElementById(`bank-row-${focusIndex}`)?.scrollIntoView({ block: 'nearest' })
		);
	}

	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const inText =
			target.tagName === 'INPUT' &&
			['text', 'search', 'number'].includes((target as HTMLInputElement).type);
		if (e.key === 'Escape') return; // a natív dialog bezárja
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (target.tagName === 'SELECT') return;
			e.preventDefault();
			const next = Math.min(
				results.length - 1,
				Math.max(0, focusIndex + (e.key === 'ArrowDown' ? 1 : -1))
			);
			if (e.shiftKey) {
				anchorIndex ??= focusIndex;
				selectRange(anchorIndex, next);
			} else anchorIndex = null;
			focusIndex = next;
			scrollFocused();
			if (inText) (document.getElementById('bank-list') as HTMLElement | null)?.focus();
			return;
		}
		if (e.key === 'Enter' && !(target.tagName === 'BUTTON')) {
			e.preventDefault();
			if (selected.length > 0) onadd(selected);
			else if (results[focusIndex] && !excluded.has(results[focusIndex].id)) {
				onadd([results[focusIndex].id]);
			}
			return;
		}
		if (inText || target.tagName === 'SELECT') return;
		if (e.key === ' ') {
			e.preventDefault();
			const row = results[focusIndex];
			if (row) toggle(row.id);
		} else if (e.key === '/') {
			e.preventDefault();
			searchEl?.focus();
		} else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
			e.preventDefault();
			if (themeId) ondraw(themeId, drawCount);
		}
	}

	const themeTitle = (id: string | null) => themes.find((t) => t.id === id)?.title ?? '—';
</script>

<dialog
	bind:this={dialog}
	class="drawer"
	aria-labelledby="bank-title"
	onclose={() => (open = false)}
	onkeydown={onKeydown}
>
	<header>
		<div class="title-row">
			<div>
				<h2 id="bank-title">Kérdésbank</h2>
				<p>cél: <strong>{targetLabel}</strong></p>
			</div>
			<button type="button" class="ghost" onclick={() => (open = false)}>Bezárás · Esc</button>
		</div>
		<label class="search">
			<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
			>
			<input
				bind:this={searchEl}
				type="search"
				placeholder="Keresés a kérdések szövegében…"
				aria-label="Keresés"
				bind:value={search}
			/>
			<kbd>/</kbd>
		</label>
		<div class="filters">
			<select bind:value={themeId} aria-label="Téma">
				<option value="">Minden téma</option>
				{#each themes as theme (theme.id)}
					<option value={theme.id}>{theme.title}</option>
				{/each}
			</select>
			<select bind:value={typeCode} aria-label="Típus">
				<option value="">Minden típus</option>
				{#each Object.entries(TYPE_SHORT) as [code, label] (code)}
					<option value={code}>{label}</option>
				{/each}
			</select>
			<label class="chip" class:on={onlyFresh}>
				<input type="checkbox" bind:checked={onlyFresh} /> Csak még nem játszott
			</label>
			<label class="chip" class:on={onlyImage}>
				<input type="checkbox" bind:checked={onlyImage} /> Van kép
			</label>
			<span class="count">{results.length} találat</span>
		</div>
	</header>

	<div
		id="bank-list"
		class="list"
		role="listbox"
		aria-multiselectable="true"
		aria-label="Találatok"
		tabindex="0"
		aria-activedescendant={results[focusIndex] ? `bank-row-${focusIndex}` : undefined}
	>
		{#each results as q, i (q.id)}
			{@const inRound = excluded.has(q.id)}
			{@const isSelected = selected.includes(q.id)}
			<div
				id="bank-row-{i}"
				class="row"
				class:focus={i === focusIndex}
				class:selected={isSelected}
				class:disabled={inRound}
				role="option"
				aria-selected={isSelected}
				aria-disabled={inRound}
				tabindex="-1"
				onclick={() => {
					focusIndex = i;
					toggle(q.id);
				}}
				onkeydown={() => {}}
			>
				<span class="box" aria-hidden="true">{isSelected ? '✓' : ''}</span>
				<span class="text">
					<span class="prompt">{q.prompt}</span>
					<span class="meta"
						>{TYPE_SHORT[q.type_code] ?? q.type_code} · {themeTitle(q.theme_id)}{q.has_image
							? ' · kép'
							: ''}</span
					>
				</span>
				<span class="used" class:fresh={q.played_count === 0}>
					{inRound
						? 'már a körben'
						: q.played_count === 0
							? 'sosem játszott'
							: `játszott: ${q.played_last ?? ''}${q.played_count > 1 ? ` (+${q.played_count - 1})` : ''}`}
				</span>
			</div>
		{:else}
			<p class="empty">Nincs találat ezzel a szűréssel.</p>
		{/each}
	</div>

	<footer>
		<span class="summary"
			><strong>{selected.length} kiválasztva</strong>
			<span class="dim">· Szóköz jelöl, Shift+↑↓ tartomány</span></span
		>
		<label class="draw">
			<span class="dim">Random</span>
			<input type="number" min="1" max="40" bind:value={drawCount} aria-label="Random darabszám" />
			<button
				type="button"
				class="ghost"
				disabled={!themeId || busy}
				title={themeId ? '' : 'Előbb válassz témát'}
				onclick={() => ondraw(themeId, drawCount)}>a témából <kbd>R</kbd></button
			>
		</label>
		<button
			type="button"
			class="primary"
			disabled={selected.length === 0 || busy}
			onclick={() => onadd(selected)}>Hozzáadás <kbd>Enter</kbd></button
		>
	</footer>
</dialog>

<style>
	.drawer {
		position: fixed;
		inset: 0 0 0 auto;
		width: min(56rem, 100vw);
		height: 100dvh;
		max-height: 100dvh;
		max-width: 100vw;
		margin: 0;
		padding: 0;
		border: 0;
		display: none;
		flex-direction: column;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: -18px 0 40px rgb(28 27 24 / 18%);
	}

	.drawer[open] {
		display: flex;
	}

	.drawer::backdrop {
		background: rgb(28 27 24 / 30%);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.2rem 1.5rem 0.9rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.6rem;
	}

	.title-row p {
		margin: 0.2rem 0 0;
		color: var(--marquee-dim);
		font-size: 0.9rem;
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.ghost,
	.primary {
		min-height: 2.6rem;
		padding: 0 0.9rem;
		border-radius: 0.55rem;
		font-weight: 600;
	}

	.ghost {
		border: 1px solid var(--field-border, #d5cec0);
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.primary {
		border: 0;
		background: var(--btn-primary, var(--cyan));
		color: var(--on-primary, #fff);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	button:focus-visible,
	select:focus-visible,
	input:focus-visible,
	.list:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 2.9rem;
		padding: 0 0.9rem;
		border: 2px solid var(--cyan);
		border-radius: 0.7rem;
	}

	.search svg {
		fill: none;
		stroke: var(--marquee-dim);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: none;
		font: inherit;
		font-size: 1rem;
		background: transparent;
		color: var(--marquee);
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	select {
		height: 2.2rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 999px;
		padding: 0 0.7rem;
		font: inherit;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 2.2rem;
		padding: 0 0.8rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 999px;
		cursor: pointer;
	}

	.chip.on {
		border-color: transparent;
		background: color-mix(in srgb, var(--cyan) 14%, var(--cabinet-2));
		font-weight: 600;
	}

	.chip input {
		accent-color: var(--cyan);
	}

	.count {
		margin-left: auto;
		color: var(--marquee-dim);
	}

	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 0.9rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.7rem 0.75rem;
		margin-bottom: 0.25rem;
		border-radius: 0.7rem;
		cursor: pointer;
	}

	.row:hover {
		background: color-mix(in srgb, var(--cabinet) 60%, var(--cabinet-2));
	}

	.row.focus {
		outline: 2px solid var(--cyan);
		outline-offset: -2px;
	}

	.row.selected {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
	}

	.row.disabled {
		opacity: 0.5;
		cursor: default;
	}

	.box {
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--field-border, #c9bfa9);
		border-radius: 0.35rem;
		font-weight: 800;
		font-size: 0.85rem;
	}

	.row.selected .box {
		border-color: var(--cyan);
		background: var(--cyan);
		color: var(--on-primary, #fff);
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.prompt {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta,
	.used,
	.dim {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.used {
		flex-shrink: 0;
		max-width: 12rem;
		text-align: right;
	}

	.used.fresh {
		color: var(--power);
	}

	.empty {
		color: var(--marquee-dim);
		padding: 1rem;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.7rem;
		padding: 0.9rem 1.5rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
		background: color-mix(in srgb, var(--cabinet) 40%, var(--cabinet-2));
	}

	.summary {
		margin-right: auto;
		font-size: 0.9rem;
	}

	.draw {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.draw input {
		width: 3.6rem;
		height: 2.4rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.5rem;
		font: inherit;
	}

	@media (max-width: 640px) {
		.used {
			display: none;
		}
	}
</style>
