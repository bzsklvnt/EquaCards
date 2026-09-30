<script lang="ts">
	// Vékony időzítő-csík a telefon tetején (a nagy kör helyett, hogy a
	// válaszlapok kiférjenek) — docs/features/question-layout.md. A csík a
	// képernyő tetejére tapad, így görgetés közben is látszik.
	let {
		secondsLeft,
		duration,
		label = null,
		calm = false
	}: {
		secondsLeft: number;
		duration: number;
		/** Rövid felirat a számláló előtt (pl. „Olvasás”). */
		label?: string | null;
		/** Olvasási idő: nyugodt szín, nincs piros vég. */
		calm?: boolean;
	} = $props();

	const ratio = $derived(duration > 0 ? Math.max(0, Math.min(1, secondsLeft / duration)) : 0);
	const low = $derived(!calm && secondsLeft <= 5);
</script>

<div
	class="timer-bar"
	class:low
	class:calm
	role="timer"
	aria-label="{label ?? 'Hátralévő idő'}: {secondsLeft} másodperc"
>
	<div class="track"><div class="fill" style="width: {ratio * 100}%"></div></div>
	<span class="seconds" aria-hidden="true"
		>{#if label}<span class="label">{label}</span>{/if}{secondsLeft}</span
	>
</div>

<style>
	.timer-bar {
		--bar: var(--cyan);
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 -1rem;
		padding: 0.45rem 1rem;
		background: color-mix(in srgb, var(--cabinet) 88%, transparent);
		backdrop-filter: blur(6px);
	}

	.timer-bar.calm {
		--bar: var(--marquee-dim);
	}

	.timer-bar.low {
		--bar: var(--danger);
	}

	.track {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--marquee-dim) 25%, transparent);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--bar);
		transition:
			width 0.25s linear,
			background 0.2s ease;
	}

	.seconds {
		min-width: 2.2rem;
		font-family: var(--font-led);
		font-size: 1.2rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--bar);
	}

	.label {
		margin-right: 0.4rem;
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
