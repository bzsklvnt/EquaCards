<script module lang="ts">
	export type PaletteEntry = {
		group: string;
		title: string;
		sub?: string;
		href: string;
		/** Shift+Enter alternatív célja (pl. kvízestén az Esemény fül). */
		altHref?: string;
		keys?: string;
	};
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// Ctrl+K parancspaletta: oldalak, parancsok és keresés (kvízesték,
	// kérdések, helyszínek, témák) — docs/features/admin-workspace.md.
	let {
		open = $bindable(false),
		entries,
		canSearch
	}: {
		open?: boolean;
		entries: PaletteEntry[];
		canSearch: boolean;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let active = $state(0);
	let remote = $state<PaletteEntry[]>([]);
	let loading = $state(false);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			query = '';
			remote = [];
			active = 0;
			dialog.showModal();
			queueMicrotask(() => input?.focus());
		}
		if (!open && dialog.open) dialog.close();
	});

	type Hit = { group: string; kind: string; id: string; title: string; sub: string };

	function hrefFor(hit: Hit): { href: string; alt?: string } {
		switch (hit.kind) {
			case 'game':
				return {
					href: resolve('/admin/games/[id]', { id: hit.id }),
					alt: resolve('/admin/games/[id]/event', { id: hit.id })
				};
			case 'question':
				return { href: `${resolve('/admin/questions')}?id=${hit.id}` };
			case 'venue':
				return { href: `${resolve('/admin/venues')}?id=${hit.id}` };
			default:
				return { href: `${resolve('/admin/themes')}?id=${hit.id}` };
		}
	}

	$effect(() => {
		const q = query.trim();
		if (!canSearch || q.length < 2) {
			remote = [];
			return;
		}
		loading = true;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${resolve('/admin/search')}?q=${encodeURIComponent(q)}`, {
					signal: controller.signal
				});
				const body = (await res.json()) as { results: Hit[] };
				remote = body.results.map((hit) => {
					const target = hrefFor(hit);
					return {
						group: hit.group,
						title: hit.title,
						sub: hit.kind === 'game' ? 'Enter: összerakó · Shift+Enter: esemény' : hit.sub,
						href: target.href,
						altHref: target.alt
					};
				});
			} catch {
				// megszakított / sikertelen keresés — a helyi találatok maradnak
			} finally {
				loading = false;
			}
		}, 180);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	const local = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q ? entries.filter((e) => e.title.toLowerCase().includes(q)) : entries;
	});
	const results = $derived([...remote, ...local]);

	$effect(() => {
		if (active >= results.length) active = Math.max(0, results.length - 1);
	});

	function choose(entry: PaletteEntry | undefined, alt = false) {
		if (!entry) return;
		open = false;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- az entry-k href-jei már resolve()-oltak
		void goto(alt && entry.altHref ? entry.altHref : entry.href);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const delta = e.key === 'ArrowDown' ? 1 : -1;
			active = Math.min(results.length - 1, Math.max(0, active + delta));
			queueMicrotask(() =>
				document.getElementById(`pal-${active}`)?.scrollIntoView({ block: 'nearest' })
			);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(results[active], e.shiftKey);
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="palette"
	aria-label="Keresés és parancsok"
	onclose={() => (open = false)}
	onkeydown={onKeydown}
>
	<div class="search">
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
			><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
		>
		<input
			bind:this={input}
			bind:value={query}
			placeholder={canSearch ? 'Kvízeste, kérdés, helyszín vagy parancs…' : 'Oldal…'}
			aria-label="Keresés"
			role="combobox"
			aria-expanded="true"
			aria-controls="palette-list"
			aria-activedescendant={results[active] ? `pal-${active}` : undefined}
		/>
		{#if loading}<span class="dim">keresés…</span>{/if}
		<kbd>Esc</kbd>
	</div>
	<div id="palette-list" class="list" role="listbox" aria-label="Találatok">
		{#each results as entry, i (entry.href + entry.title + i)}
			{#if i === 0 || results[i - 1].group !== entry.group}
				<div class="group" role="presentation">{entry.group}</div>
			{/if}
			<div
				id="pal-{i}"
				class="entry"
				class:active={i === active}
				role="option"
				aria-selected={i === active}
				tabindex="-1"
				onclick={() => choose(entry)}
				onkeydown={() => {}}
				onmousemove={() => (active = i)}
			>
				<span class="text">
					<strong>{entry.title}</strong>
					{#if entry.sub}<span>{entry.sub}</span>{/if}
				</span>
				{#if entry.keys}<kbd>{entry.keys}</kbd>{/if}
			</div>
		{:else}
			<p class="empty">Nincs találat.</p>
		{/each}
	</div>
	<div class="foot">
		<span><kbd>↑ ↓</kbd> léptetés</span>
		<span><kbd>Enter</kbd> megnyitás</span>
		<span><kbd>G</kbd> majd betű: ugrás egy oldalra</span>
	</div>
</dialog>

<style>
	.palette {
		width: min(42rem, calc(100vw - 2rem));
		margin: 12vh auto auto;
		padding: 0;
		border: 0;
		border-radius: 1rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: 0 30px 60px rgb(0 0 0 / 30%);
		overflow: hidden;
	}

	.palette::backdrop {
		background: rgb(28 27 24 / 40%);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.9rem 1.1rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
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
		background: transparent;
		color: var(--marquee);
		font: inherit;
		font-size: 1.1rem;
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	.dim {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.list {
		max-height: min(26rem, 60dvh);
		overflow-y: auto;
		padding: 0.4rem 0.6rem 0.6rem;
	}

	.group {
		padding: 0.6rem 0.5rem 0.2rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0.7rem;
		border-radius: 0.6rem;
		cursor: pointer;
	}

	.entry.active {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
	}

	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.text strong {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.text span {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.empty {
		margin: 0;
		padding: 1rem;
		color: var(--marquee-dim);
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.6rem 1.1rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
		background: color-mix(in srgb, var(--cabinet) 40%, var(--cabinet-2));
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}
</style>
