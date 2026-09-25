<script lang="ts">
	import { serverNow } from '$lib/realtime/server-clock';

	// Pixeles képfelfedés (docs/features/pixel-reveal.md): a kép a
	// visszaszámlálás elején ~12 "kocka" széles, és exponenciálisan (a szemnek
	// egyenletes ütemben) élesedik a teljes felbontásig. A haladást a közös,
	// kalibrált szerveridőhöz (serverNow) mérjük, így a TV és minden telefon
	// ugyanabban a pillanatban ugyanazt a felbontást mutatja.
	const START_COLUMNS = 12;
	const MAX_CANVAS_WIDTH = 1280;

	let {
		src,
		startTime = null,
		duration = 0,
		sharp = false
	}: {
		src: string;
		/** A timer_start szerver-időbélyege; amíg null, a kép a legpixelesebb. */
		startTime?: string | null;
		duration?: number;
		/** Lezárás/feltárás után azonnal az eredeti kép. */
		sharp?: boolean;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let image: HTMLImageElement | null = $state(null);

	$effect(() => {
		const img = new Image();
		img.onload = () => (image = img);
		img.src = src;
		return () => {
			img.onload = null;
		};
	});

	$effect(() => {
		if (!canvas || !image) return;
		const target = canvas;
		const img = image;
		const scale = Math.min(1, MAX_CANVAS_WIDTH / img.naturalWidth);
		target.width = Math.max(1, Math.round(img.naturalWidth * scale));
		target.height = Math.max(1, Math.round(img.naturalHeight * scale));
		const ctx = target.getContext('2d');
		const small = document.createElement('canvas');
		const smallCtx = small.getContext('2d');
		if (!ctx || !smallCtx) return;

		const startMs = startTime ? new Date(startTime).getTime() : null;
		const totalMs = duration * 1000;
		const isSharp = sharp;

		const progress = () => {
			if (isSharp) return 1;
			if (startMs === null || totalMs <= 0) return 0;
			return Math.min(1, Math.max(0, (serverNow() - startMs) / totalMs));
		};

		let lastColumns = -1;
		let frame = 0;
		const draw = () => {
			const p = progress();
			const columns =
				p >= 1
					? target.width
					: Math.min(
							target.width,
							Math.round(START_COLUMNS * Math.pow(target.width / START_COLUMNS, p))
						);
			if (columns !== lastColumns) {
				lastColumns = columns;
				ctx.clearRect(0, 0, target.width, target.height);
				if (columns >= target.width) {
					ctx.imageSmoothingEnabled = true;
					ctx.drawImage(img, 0, 0, target.width, target.height);
				} else {
					small.width = columns;
					small.height = Math.max(1, Math.round((columns * target.height) / target.width));
					smallCtx.drawImage(img, 0, 0, small.width, small.height);
					ctx.imageSmoothingEnabled = false;
					ctx.drawImage(small, 0, 0, target.width, target.height);
				}
			}
			if (p < 1 && startMs !== null) frame = requestAnimationFrame(draw);
		};
		draw();
		return () => cancelAnimationFrame(frame);
	});
</script>

<div role="img" aria-label="A kérdés képe, fokozatosan élesedik">
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
	canvas {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: var(--pixel-max-height, 14rem);
		margin: 0 auto 0.5rem;
		border-radius: 0.5rem;
		image-rendering: pixelated;
	}
</style>
