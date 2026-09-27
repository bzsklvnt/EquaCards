<script lang="ts">
	import { untrack } from 'svelte';
	import { saveStatus } from '$lib/admin/save-status.svelte';
	import type { SaveState } from '$lib/admin/autosave.svelte';

	// Mentésállapot a kezelői menüsáv tetején: zöld = mentve, sárga = mentés
	// folyamatban / mentésre vár, piros = hiba. Összecsukott menüben és
	// telefonon csak a pötty látszik (a szöveg a címkében / súgóban).
	let { compact = false }: { compact?: boolean } = $props();

	// A rövid mentések ne villogjanak: a sárga állapot csak ~0,6 mp után jelenik meg.
	let shown = $state<SaveState | null>(untrack(() => saveStatus.state));
	$effect(() => {
		const next = saveStatus.state;
		const current = untrack(() => shown);
		const busy = (s: SaveState | null) => s === 'saving' || s === 'dirty';
		if (busy(next) && !busy(current)) {
			const timer = setTimeout(() => (shown = next), 600);
			return () => clearTimeout(timer);
		}
		shown = next;
	});

	const LABEL: Record<SaveState, string> = {
		saved: 'Mentve',
		dirty: 'Nem mentett',
		saving: 'Mentés…',
		error: 'Mentési hiba'
	};

	const label = $derived(shown ? LABEL[shown] : 'Automatikus mentés');
	const tone = $derived(
		shown === 'saved'
			? 'ok'
			: shown === 'saving' || shown === 'dirty'
				? 'busy'
				: shown === 'error'
					? 'error'
					: 'idle'
	);
	const title = $derived(
		shown === 'error' && saveStatus.error
			? `Mentési hiba: ${saveStatus.error}`
			: shown === 'dirty'
				? 'Nem mentett változás — hamarosan automatikusan mentődik'
				: label
	);
</script>

<div class="save {tone}" class:compact {title} role="status" aria-live="polite">
	<span class="dot" aria-hidden="true"></span>
	<span class="text" class:sr-only={compact}>{label}</span>
</div>

<style>
	.save {
		--dot: var(--marquee-dim);
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		height: 2rem;
		font-size: 0.82rem;
		color: var(--marquee-dim);
		white-space: nowrap;
	}

	.save.ok {
		--dot: var(--power, #1e7a4f);
		color: var(--marquee);
	}

	.save.busy {
		--dot: #d9a21b;
		color: var(--marquee);
	}

	.save.error {
		--dot: var(--danger, #a3261e);
		color: var(--danger, #a3261e);
		font-weight: 600;
	}

	.save.idle {
		--dot: color-mix(in srgb, var(--marquee-dim) 45%, transparent);
	}

	.save.compact {
		justify-content: center;
	}

	.dot {
		flex-shrink: 0;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--dot);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot) 20%, transparent);
		transition: background 0.2s ease;
	}

	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
