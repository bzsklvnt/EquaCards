<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { plainKey } from '$lib/admin/keys.svelte';

	// Bal oldali lista a kezelői oldalakon: keresés (/), csoportok, ↑/↓ (J/K)
	// léptetés, Enter megnyitás. docs/features/admin-workspace.md.
	let {
		groups,
		getId,
		selectedId,
		onselect,
		onopen,
		item,
		search = $bindable(''),
		placeholder,
		header,
		footer,
		label,
		empty = 'Nincs találat.',
		keyboard = true
	}: {
		groups: { label?: string; meta?: string; items: T[] }[];
		getId: (item: T) => string;
		selectedId: string | null;
		onselect: (item: T) => void;
		onopen?: (item: T) => void;
		item: Snippet<[T, boolean]>;
		search?: string;
		placeholder?: string;
		header?: Snippet;
		footer?: Snippet;
		label: string;
		empty?: string;
		keyboard?: boolean;
	} = $props();

	let searchEl = $state<HTMLInputElement>();
	const flat = $derived(groups.flatMap((g) => g.items));

	async function focusSelected() {
		await tick();
		const el = document.querySelector<HTMLElement>(`[data-rail-id="${selectedId}"]`);
		el?.scrollIntoView({ block: 'nearest' });
		el?.focus({ preventScroll: true });
	}

	function move(delta: number) {
		if (flat.length === 0) return;
		const i = flat.findIndex((x) => getId(x) === selectedId);
		const next = flat[Math.min(flat.length - 1, Math.max(0, (i === -1 ? -1 : i) + delta))];
		if (next) {
			onselect(next);
			void focusSelected();
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (!keyboard) return;
		if (e.key === 'Escape' && e.target === searchEl) {
			searchEl?.blur();
			void focusSelected();
			return;
		}
		if (!plainKey(e)) return;
		const onButton = e.target instanceof HTMLButtonElement && !e.target.dataset.railId;
		switch (e.key) {
			case 'ArrowDown':
			case 'j':
			case 'J':
				e.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
			case 'k':
			case 'K':
				e.preventDefault();
				move(-1);
				break;
			case '/':
				if (searchEl) {
					e.preventDefault();
					searchEl.focus();
				}
				break;
			case 'Enter': {
				if (onButton || !onopen) return;
				const current = flat.find((x) => getId(x) === selectedId);
				if (current) {
					e.preventDefault();
					onopen(current);
				}
				break;
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="rail-list">
	{#if placeholder || header}
		<div class="head">
			{#if placeholder}
				<label class="search">
					<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
					>
					<input bind:this={searchEl} bind:value={search} {placeholder} aria-label={placeholder} />
					<kbd>/</kbd>
				</label>
			{/if}
			{#if header}{@render header()}{/if}
		</div>
	{/if}
	<div class="items" role="listbox" aria-label={label}>
		{#each groups as group, gi (group.label ?? gi)}
			{#if group.label && group.items.length > 0}
				<div class="group" role="presentation">
					<span>{group.label}</span>{#if group.meta}<span>{group.meta}</span>{/if}
				</div>
			{/if}
			{#each group.items as entry (getId(entry))}
				{@const on = getId(entry) === selectedId}
				<button
					type="button"
					class="entry"
					class:on
					role="option"
					aria-selected={on}
					data-rail-id={getId(entry)}
					onclick={() => onselect(entry)}
					ondblclick={() => onopen?.(entry)}
				>
					{@render item(entry, on)}
				</button>
			{/each}
		{/each}
		{#if flat.length === 0}
			<p class="empty">{empty}</p>
		{/if}
	</div>
	{#if footer}
		<div class="foot">{@render footer()}</div>
	{/if}
</div>

<style>
	.rail-list {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem 0.9rem 0.5rem;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 2.4rem;
		box-sizing: border-box;
		padding: 0 0.7rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		background: var(--cabinet-2);
	}

	.search:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.search svg {
		fill: none;
		stroke: var(--marquee-dim);
		stroke-width: 2;
		stroke-linecap: round;
		flex-shrink: 0;
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: none;
		background: transparent;
		font: inherit;
		color: var(--marquee);
	}

	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		color: var(--marquee-dim);
	}

	.items {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 0.6rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.group {
		display: flex;
		justify-content: space-between;
		padding: 0.7rem 0.25rem 0.15rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.55rem 0.6rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.65rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.entry:hover {
		border-color: color-mix(in srgb, var(--cyan) 40%, var(--panel-border, #e4ded2));
	}

	.entry.on {
		border: 2px solid var(--cyan);
		padding: calc(0.55rem - 1px) calc(0.6rem - 1px);
		background: color-mix(in srgb, var(--cyan) 10%, var(--cabinet-2));
	}

	.entry:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.empty {
		margin: 0.5rem 0.3rem;
		color: var(--marquee-dim);
		font-size: 0.88rem;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.7rem 0.8rem 0.8rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}
</style>
