<script lang="ts">
	let {
		secondsLeft,
		duration,
		size = 120,
		inactive = false
	}: {
		secondsLeft: number;
		duration: number;
		size?: number;
		inactive?: boolean;
	} = $props();

	let radius = $derived((size - 12) / 2);
	let circumference = $derived(2 * Math.PI * radius);
	let fraction = $derived(
		inactive ? 0.25 : duration > 0 ? Math.max(0, Math.min(1, secondsLeft / duration)) : 0
	);
	let low = $derived(!inactive && secondsLeft <= 5 && secondsLeft > 0);
</script>

<div class="timer-ring" style="width: {size}px; height: {size}px" class:low class:inactive>
	<svg width={size} height={size} viewBox="0 0 {size} {size}">
		<circle class="track" cx={size / 2} cy={size / 2} r={radius} />
		<circle
			class="progress"
			cx={size / 2}
			cy={size / 2}
			r={radius}
			stroke-dasharray={circumference}
			stroke-dashoffset={circumference * (1 - fraction)}
		/>
	</svg>
	{#if !inactive}
		<span class="seconds" style="font-size: {size / 3}px">{secondsLeft}</span>
	{/if}
</div>

<style>
	.timer-ring {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	svg {
		transform: rotate(-90deg);
		width: 100%;
		height: 100%;
	}

	.track {
		fill: none;
		stroke: var(--cabinet-2);
		stroke-width: 8;
	}

	.progress {
		fill: none;
		stroke: var(--cyan);
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dashoffset 0.2s linear;
	}

	.timer-ring.low .progress {
		stroke: var(--danger);
		animation: pulse 0.6s ease-in-out infinite;
	}

	.seconds {
		position: absolute;
		font-family: var(--font-led);
		color: var(--marquee);
		font-weight: bold;
	}

	.timer-ring.low .seconds {
		color: var(--danger);
	}

	.timer-ring.inactive .progress {
		stroke: var(--marquee-dim);
		animation: none;
	}

	.timer-ring.inactive svg {
		animation: spin 1.1s linear infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(270deg);
		}
	}
</style>
