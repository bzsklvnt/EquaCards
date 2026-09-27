<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		CSV_TEMPLATE,
		MAX_IMPORT_ROWS,
		normalizePrompt,
		readQuestionCsv,
		type CsvRow
	} from '$lib/questions/csv';
	import { TYPE_SHORT, type Draft } from '$lib/builder/model';
	import type { PageData } from './$types';

	// Kérdésbank-import CSV-ből (docs/features/question-import.md):
	// 1. fájl → 2. előnézet soronkénti hibákkal, témák hozzárendelése,
	// duplikátumok → 3. import kötegenként, haladásjelzővel.
	let { data }: { data: PageData } = $props();

	const NEW = '__new__';
	const NONE = '';
	const BATCH = 40;

	let fileName = $state('');
	let rows = $state<CsvRow[]>([]);
	let fileError = $state('');
	let dragOver = $state(false);
	let onlyProblems = $state(false);
	let skipDuplicates = $state(true);
	/** CSV-beli témanév (kisbetűsen) → meglévő téma id, NEW vagy NONE. */
	let themeChoice = $state<Record<string, string>>({});
	let importing = $state(false);
	let progress = $state({ done: 0, total: 0 });
	let result = $state<{ imported: number; failed: { line: number; error: string }[] } | null>(null);

	const themeById = $derived(new Map(data.themes.map((t) => [t.id, t.title])));
	const themeByTitle = $derived(
		new Map(data.themes.map((t) => [t.title.toLocaleLowerCase('hu'), t.id]))
	);

	// Témák a fájlban: ami egyezik egy meglévővel, oda kerül; az ismeretlent
	// alapból létrehozzuk (átirányítható meglévő témára).
	const csvThemes = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- helyi, számításon belüli gyűjtő
		const seen = new Map<string, string>();
		for (const r of rows) {
			const key = r.themeTitle.toLocaleLowerCase('hu');
			if (!seen.has(key)) seen.set(key, r.themeTitle);
		}
		return [...seen.entries()].map(([key, title]) => ({
			key,
			title,
			existing: themeByTitle.get(key) ?? null
		}));
	});
	const unknownThemes = $derived(csvThemes.filter((t) => t.key !== '' && !t.existing));
	const hasNoTheme = $derived(csvThemes.some((t) => t.key === ''));

	function targetFor(row: CsvRow): string {
		const key = row.themeTitle.toLocaleLowerCase('hu');
		const existing = themeByTitle.get(key);
		if (existing) return existing;
		return themeChoice[key] ?? (key === '' ? NONE : NEW);
	}

	/** Duplikátum-kulcs: kérdésszöveg + cél-téma. */
	function dupKey(row: CsvRow): string {
		const target = targetFor(row);
		const theme = target === NEW ? `new:${row.themeTitle.toLocaleLowerCase('hu')}` : target;
		return `${normalizePrompt(row.draft?.prompt ?? '')}|${theme}`;
	}

	const bankKeys = $derived(
		new Set(data.existing.map((q) => `${normalizePrompt(q.prompt)}|${q.theme_id ?? ''}`))
	);

	type Checked = CsvRow & { duplicate: 'bank' | 'file' | null };
	const checked = $derived.by((): Checked[] => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- helyi, számításon belüli gyűjtő
		const inFile = new Set<string>();
		return rows.map((row) => {
			if (!row.draft) return { ...row, duplicate: null };
			const key = dupKey(row);
			const duplicate = bankKeys.has(key) ? 'bank' : inFile.has(key) ? 'file' : null;
			inFile.add(key);
			return { ...row, duplicate };
		});
	});

	const valid = $derived(checked.filter((r) => r.draft));
	const invalid = $derived(checked.filter((r) => !r.draft));
	const duplicates = $derived(valid.filter((r) => r.duplicate));
	const toImport = $derived(valid.filter((r) => !(skipDuplicates && r.duplicate)));
	const shown = $derived(onlyProblems ? checked.filter((r) => !r.draft || r.duplicate) : checked);

	function downloadTemplate() {
		const url = URL.createObjectURL(
			new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'kerdesbank-minta.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	// Az Excel magyar beállítással gyakran Windows-1250 kódolással ment —
	// ha a fájl nem érvényes UTF-8, azzal olvassuk.
	function decode(buffer: ArrayBuffer): string {
		try {
			return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
		} catch {
			return new TextDecoder('windows-1250').decode(buffer);
		}
	}

	async function loadFile(file: File) {
		fileError = '';
		result = null;
		if (file.size > 5 * 1024 * 1024) {
			fileError = 'A fájl túl nagy (max. 5 MB).';
			return;
		}
		const parsed = readQuestionCsv(decode(await file.arrayBuffer()), data.types, {
			defaultTime: data.defaultTime
		});
		fileName = file.name;
		rows = parsed.rows;
		themeChoice = {};
		onlyProblems = false;
		if (parsed.error) fileError = parsed.error;
	}

	function onFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void loadFile(file);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) void loadFile(file);
	}

	async function post<T>(body: Record<string, unknown>): Promise<T> {
		const res = await fetch(resolve('/admin/questions/import'), {
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

	async function runImport() {
		if (importing || toImport.length === 0) return;
		importing = true;
		result = null;
		progress = { done: 0, total: toImport.length };
		const failed: { line: number; error: string }[] = [];
		let imported = 0;
		try {
			// 1. A létrehozandó témák.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- helyi gyűjtő
			const byKey = new Map<string, string>();
			for (const r of toImport) {
				if (targetFor(r) !== NEW) continue;
				const key = r.themeTitle.toLocaleLowerCase('hu');
				if (!byKey.has(key)) byKey.set(key, r.themeTitle);
			}
			const newTitles = [...byKey.values()];
			let created: Record<string, string> = {};
			if (newTitles.length > 0) {
				created = (await post<{ map: Record<string, string> }>({ op: 'themes', titles: newTitles }))
					.map;
			}
			const createdByKey = new Map(
				Object.entries(created).map(([title, id]) => [title.toLocaleLowerCase('hu'), id])
			);

			// 2. A kérdések kötegenként.
			const items = toImport.map((r) => {
				const target = targetFor(r);
				const theme_id =
					target === NEW
						? (createdByKey.get(r.themeTitle.trim().toLocaleLowerCase('hu')) ?? null)
						: target || null;
				return { line: r.line, draft: { ...(r.draft as Draft), theme_id } };
			});
			for (let i = 0; i < items.length; i += BATCH) {
				const batch = items.slice(i, i + BATCH);
				try {
					const { results } = await post<{ results: ({ id: string } | { error: string })[] }>({
						op: 'save',
						drafts: batch.map((b) => b.draft)
					});
					results.forEach((r, j) => {
						if ('id' in r) imported += 1;
						else failed.push({ line: batch[j].line, error: r.error });
					});
				} catch (err) {
					for (const b of batch) failed.push({ line: b.line, error: (err as Error).message });
				}
				progress = { done: Math.min(items.length, i + BATCH), total: items.length };
			}
			result = { imported, failed };
			if (imported > 0) {
				toast.success(`${imported} kérdés bekerült a kérdésbankba.`);
				await invalidate('app:page');
			}
			if (failed.length > 0) toast.error(`${failed.length} kérdést nem sikerült menteni.`);
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			importing = false;
		}
	}

	function statusText(r: Checked): string {
		if (!r.draft) return r.errors.join(' ');
		if (r.duplicate === 'bank') return 'Már van ilyen kérdés ebben a témában.';
		if (r.duplicate === 'file') return 'A fájlban korábban már szerepel.';
		return 'Rendben';
	}
</script>

<svelte:head>
	<title>Importálás CSV-ből — Kérdésbank</title>
</svelte:head>

<div class="import">
	<div class="ws-crumb">
		<a href={resolve('/admin/questions')}>Kérdésbank</a> › <b>Importálás CSV-ből</b>
	</div>
	<h1 class="ws-h1">Kérdések importálása CSV-ből</h1>

	<section class="card">
		<h2>1. Fájl</h2>
		<p class="dim">
			Töltsd le a mintát, töltsd ki Excelben (egy sor = egy kérdés), majd mentsd CSV-ként
			(pontosvesszős vagy vesszős is jó). Egyszerre legfeljebb {MAX_IMPORT_ROWS} kérdés.
		</p>
		<div class="row">
			<button type="button" class="ws-btn" onclick={downloadTemplate}>Mintafájl letöltése</button>
		</div>
		<label
			class="drop"
			class:over={dragOver}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={onDrop}
		>
			<input type="file" accept=".csv,text/csv,text/plain" onchange={onFileInput} />
			<strong>{fileName || 'CSV-fájl behúzása vagy tallózás'}</strong>
			<span class="dim">{fileName ? 'Másik fájl választása' : '.csv, max. 5 MB'}</span>
		</label>
		{#if fileError}<p class="error" role="alert">{fileError}</p>{/if}

		<details class="help">
			<summary>Oszlopok</summary>
			<dl>
				<dt>téma</dt>
				<dd>A téma neve. Ha még nincs ilyen, létrehozható vagy meglévőhöz rendelhető.</dd>
				<dt>típus</dt>
				<dd>
					egy helyes · több helyes · igaz/hamis · csúszka · sorrend (üresen a kitöltésből
					következtet)
				</dd>
				<dt>kérdés</dt>
				<dd>A kérdés szövege (kötelező).</dd>
				<dt>A–H</dt>
				<dd>
					Válaszok; egy helyesnél pontosan 4, több helyesnél 6–8. Sorrendnél az elemek a helyes
					sorrendben (A = első).
				</dd>
				<dt>helyes</dt>
				<dd>
					Betűvel (A, vagy több helyesnél A,C); igaz/hamisnál „igaz” vagy „hamis”; csúszkánál a
					helyes szám.
				</dd>
				<dt>min, max, lépés, tűrés</dt>
				<dd>Csak csúszkához.</dd>
				<dt>idő, pont, kép</dt>
				<dd>
					Nem kötelező: válaszidő mp-ben (alap {data.defaultTime}), pont (alap 1000), kép https://
					címe.
				</dd>
			</dl>
		</details>
	</section>

	{#if rows.length > 0}
		<section class="card">
			<h2>2. Előnézet</h2>
			<div class="chips">
				<span class="chip">{rows.length} sor</span>
				<span class="chip ok">{valid.length} hibátlan</span>
				{#if invalid.length > 0}<span class="chip bad">{invalid.length} hibás</span>{/if}
				{#if duplicates.length > 0}<span class="chip warn">{duplicates.length} duplikátum</span
					>{/if}
				{#if invalid.length > 0 || duplicates.length > 0}
					<label class="check"
						><input type="checkbox" bind:checked={onlyProblems} /> Csak a hibás / duplikált sorok</label
					>
				{/if}
			</div>

			{#if unknownThemes.length > 0 || hasNoTheme}
				<div class="themes">
					<h3>Témák</h3>
					{#each unknownThemes as t (t.key)}
						<label class="theme-row">
							<span>„{t.title}”</span>
							<select
								value={themeChoice[t.key] ?? NEW}
								onchange={(e) => (themeChoice[t.key] = e.currentTarget.value)}
							>
								<option value={NEW}>Új téma létrehozása</option>
								<option value={NONE}>Téma nélkül</option>
								{#each data.themes as theme (theme.id)}
									<option value={theme.id}>→ {theme.title}</option>
								{/each}
							</select>
						</label>
					{/each}
					{#if hasNoTheme}
						<label class="theme-row">
							<span>Téma nélküli sorok</span>
							<select
								value={themeChoice[''] ?? NONE}
								onchange={(e) => (themeChoice[''] = e.currentTarget.value)}
							>
								<option value={NONE}>Téma nélkül</option>
								{#each data.themes as theme (theme.id)}
									<option value={theme.id}>→ {theme.title}</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>
			{/if}

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Sor</th>
							<th scope="col">Téma</th>
							<th scope="col">Típus</th>
							<th scope="col">Kérdés</th>
							<th scope="col">Állapot</th>
						</tr>
					</thead>
					<tbody>
						{#each shown as r (r.line)}
							{@const target = targetFor(r)}
							<tr class:bad={!r.draft} class:warn={r.draft && r.duplicate}>
								<td class="num">{r.line}</td>
								<td
									>{target && target !== NEW
										? themeById.get(target)
										: r.themeTitle || '—'}{#if target === NEW && r.themeTitle}
										<small class="new">új</small>{/if}</td
								>
								<td>{r.typeCode ? TYPE_SHORT[r.typeCode] : '—'}</td>
								<td class="prompt">{r.prompt || '—'}</td>
								<td class="status">{statusText(r)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="card">
			<h2>3. Importálás</h2>
			{#if duplicates.length > 0}
				<label class="check"
					><input type="checkbox" bind:checked={skipDuplicates} /> Duplikátumok kihagyása ({duplicates.length})</label
				>
			{/if}
			{#if invalid.length > 0}
				<p class="dim">
					A {invalid.length} hibás sor kimarad — javítsd a fájlban, és töltsd fel újra csak azokat.
				</p>
			{/if}
			<div class="row">
				<button
					type="button"
					class="ws-btn primary"
					disabled={importing || toImport.length === 0}
					onclick={runImport}
					>{importing
						? `Importálás… ${progress.done} / ${progress.total}`
						: `${toImport.length} kérdés importálása`}</button
				>
				<a class="ws-btn" href={resolve('/admin/questions')}>Vissza a kérdésbankba</a>
			</div>
			{#if importing}
				<div
					class="bar"
					role="progressbar"
					aria-valuenow={progress.done}
					aria-valuemax={progress.total}
				>
					<div style="width: {progress.total ? (progress.done / progress.total) * 100 : 0}%"></div>
				</div>
			{/if}
			{#if result}
				<p class="done" role="status">
					{result.imported} kérdés bekerült a kérdésbankba.{#if result.failed.length > 0}
						{result.failed.length} nem sikerült:{/if}
				</p>
				{#if result.failed.length > 0}
					<ul class="failed">
						{#each result.failed as f (f.line)}
							<li>{f.line}. sor: {f.error}</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</section>
	{/if}
</div>

<style>
	.import {
		max-width: 70rem;
		margin: 0 auto;
		padding: 1.4rem 1.6rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ws-crumb a {
		color: inherit;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.9rem;
		background: var(--cabinet-2);
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	p {
		margin: 0;
	}

	.dim {
		color: var(--marquee-dim);
		font-size: 0.88rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.drop {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.4rem;
		border: 2px dashed var(--field-border, #d5cec0);
		border-radius: 0.8rem;
		text-align: center;
		cursor: pointer;
	}

	.drop.over {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 6%, var(--cabinet-2));
	}

	.drop input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.drop:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.error {
		color: var(--danger);
	}

	.help summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.help dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.35rem 1rem;
		margin: 0.6rem 0 0;
		font-size: 0.88rem;
	}

	.help dt {
		font-weight: 700;
	}

	.help dd {
		margin: 0;
		color: var(--marquee-dim);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.chip {
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: var(--cabinet);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.chip.ok {
		color: var(--power);
	}

	.chip.bad {
		color: var(--danger);
	}

	.chip.warn {
		color: #9a5412;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.themes {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}

	.theme-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}

	.theme-row span {
		min-width: 12rem;
		font-weight: 600;
	}

	select {
		height: 2.2rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.5rem;
		font: inherit;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.table-wrap {
		max-height: 32rem;
		overflow: auto;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.6rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.86rem;
	}

	th {
		position: sticky;
		top: 0;
		padding: 0.5rem 0.6rem;
		background: var(--cabinet);
		text-align: left;
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	td {
		padding: 0.45rem 0.6rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
		vertical-align: top;
	}

	td.num {
		color: var(--marquee-dim);
		font-variant-numeric: tabular-nums;
	}

	td.prompt {
		max-width: 26rem;
	}

	tr.bad td.status {
		color: var(--danger);
	}

	tr.warn td.status {
		color: #9a5412;
	}

	td small.new {
		margin-left: 0.35rem;
		padding: 0 0.35rem;
		border-radius: 0.3rem;
		background: var(--cabinet);
		color: var(--marquee-dim);
		font-size: 0.75rem;
	}

	.bar {
		height: 6px;
		border-radius: 3px;
		background: var(--cabinet);
		overflow: hidden;
	}

	.bar div {
		height: 100%;
		background: var(--cyan);
		transition: width 0.2s ease;
	}

	.done {
		font-weight: 600;
	}

	.failed {
		margin: 0;
		padding-left: 1.2rem;
		color: var(--danger);
		font-size: 0.88rem;
	}
</style>
